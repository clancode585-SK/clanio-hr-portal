<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\User;
use App\Support\NotificationType;
use App\Support\Realtime;
use App\Support\TenantCache;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class EmployeeDocumentService
{
    private const DISK = 'local';

    public function __construct(private readonly NotificationService $notifications) {}

    public function upload(Employee $employee, array $data, UploadedFile $file, User $actor): EmployeeDocument
    {
        return DB::transaction(function () use ($employee, $data, $file, $actor): EmployeeDocument {
            $path = $file->storeAs(
                $this->directory($employee),
                Str::uuid()->toString() . '.' . strtolower($file->getClientOriginalExtension() ?: 'bin'),
                self::DISK
            );

            $document = new EmployeeDocument(Arr::only($data, ['type', 'title', 'document_number', 'issued_on', 'expires_on']));
            $document->company_id = $employee->company_id;
            $document->employee_id = $employee->id;
            $document->title = $data['title'] ?? (EmployeeDocument::TYPES[$data['type']] ?? $data['type']);
            $document->file_path = $path;
            $document->original_name = $file->getClientOriginalName();
            $document->mime_type = $file->getClientMimeType();
            $document->size_bytes = $file->getSize() ?: 0;
            $document->uploaded_by = $actor->id;
            $document->created_by = $actor->id;
            $document->save();

            TenantCache::flush(TenantCache::EMPLOYEES);

            return $document;
        });
    }

    public function verify(EmployeeDocument $document, array $data, User $actor): EmployeeDocument
    {
        $document->forceFill([
            'status' => $data['status'],
            'remarks' => $data['remarks'] ?? null,
            'verified_by' => $actor->id,
            'verified_at' => Carbon::now(),
            'updated_by' => $actor->id,
        ])->save();

        TenantCache::flush(TenantCache::EMPLOYEES);

        $document = $document->refresh()->load('verifier');

        $this->notifyVerification($document, $actor);

        return $document;
    }

    public function delete(EmployeeDocument $document, User $actor): void
    {
        if ($document->isVerified() && ! $actor->hasPermission('employee_document.manage')) {
            throw new ApiException(
                'This document is already verified. Ask HR to remove it.',
                409,
                'DOCUMENT_VERIFIED'
            );
        }

        DB::transaction(function () use ($document): void {
            if (Storage::disk(self::DISK)->exists($document->file_path)) {
                Storage::disk(self::DISK)->delete($document->file_path);
            }

            $document->deactivate();

            TenantCache::flush(TenantCache::EMPLOYEES);
        });
    }

    public function download(EmployeeDocument $document): StreamedResponse
    {
        if (! Storage::disk(self::DISK)->exists($document->file_path)) {
            throw new ApiException('This file is no longer available.', 404, 'FILE_MISSING');
        }

        return Storage::disk(self::DISK)->download($document->file_path, $document->original_name);
    }

    public function readable(EmployeeDocument $document, User $actor): bool
    {
        $employee = $document->employee;

        if ($employee === null) {
            return false;
        }

        if ((int) $employee->user_id === (int) $actor->id) {
            return true;
        }

        return $actor->hasPermission('employee_document.view')
            && Employee::query()->visibleTo($actor)->whereKey($employee->id)->exists();
    }

    private function notifyVerification(EmployeeDocument $document, User $actor): void
    {
        $employee = $document->employee;

        if ($employee === null || $employee->user_id === null) {
            return;
        }

        $verified = $document->isVerified();

        $this->notifications->send((int) $employee->user_id, [
            'type' => $verified ? NotificationType::DOCUMENT_VERIFIED : NotificationType::DOCUMENT_REJECTED,
            'title' => $document->title . ' ' . ($verified ? 'verify ho gaya' : 'reject ho gaya'),
            'body' => $document->remarks ?? ($verified
                ? 'HR ne aapka document approve kar diya hai.'
                : 'HR ne document reject kiya hai, dubara upload karo.'),
            'action_url' => '/profile/documents',
            'entity_type' => 'employee_document',
            'entity_id' => $document->id,
            'payload' => [
                'document_id' => (int) $document->id,
                'document_uuid' => $document->uuid,
                'type' => $document->type,
                'title' => $document->title,
                'status' => $document->status,
            ],
        ], $actor);

        Realtime::toUser((int) $employee->user_id, 'document.changed', [
            'document_id' => (int) $document->id,
            'status' => $document->status,
        ]);
    }

    private function directory(Employee $employee): string
    {
        return 'documents/' . $employee->company_id . '/' . $employee->id;
    }
}
