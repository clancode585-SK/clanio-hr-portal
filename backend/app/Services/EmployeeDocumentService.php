<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\User;
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

        return $document->refresh()->load('verifier');
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

            $document->delete();

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

    private function directory(Employee $employee): string
    {
        return 'documents/' . $employee->company_id . '/' . $employee->id;
    }
}
