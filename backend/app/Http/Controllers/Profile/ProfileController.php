<?php

declare(strict_types=1);

namespace App\Http\Controllers\Profile;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Requests\AvatarRequest;
use App\Http\Requests\EmployeeDocumentRequest;
use App\Http\Requests\ProfileRequest;
use App\Http\Resources\EmployeeDocumentResource;
use App\Http\Resources\ProfileResource;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\User;
use App\Services\EmployeeDocumentService;
use App\Services\ProfileCompletionService;
use App\Services\ProfileService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends ApiController
{
    public function __construct(
        private readonly ProfileService $profile,
        private readonly EmployeeDocumentService $documents,
        private readonly ProfileCompletionService $completion
    ) {}

    public function completion(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->completion->forUser(
                $request->user(),
                $request->filled('employee_id') ? (int) $request->input('employee_id') : null
            ),
            'Profile completion fetched successfully'
        );
    }

    public function show(Request $request): JsonResponse
    {
        return ApiResponse::success(
            new ProfileResource($this->profile->show($request->user())),
            'Profile fetched successfully'
        );
    }

    public function update(ProfileRequest $request): JsonResponse
    {
        return ApiResponse::success(
            new ProfileResource($this->profile->update($request->user(), $request->validated())),
            'Profile updated successfully'
        );
    }

    public function uploadAvatar(AvatarRequest $request): JsonResponse
    {
        return ApiResponse::success(
            new ProfileResource($this->profile->updateAvatar($request->user(), $request->file('avatar'))),
            'Profile photo updated successfully'
        );
    }

    public function deleteAvatar(Request $request): JsonResponse
    {
        return ApiResponse::success(
            new ProfileResource($this->profile->deleteAvatar($request->user())),
            'Profile photo removed successfully'
        );
    }

    public function documents(Request $request): JsonResponse
    {
        $employee = $this->employee($request->user());

        return ApiResponse::success(
            EmployeeDocumentResource::collection($employee->documents()->with('verifier')->latest('id')->get()),
            'Documents fetched successfully'
        );
    }

    public function uploadDocument(EmployeeDocumentRequest $request): JsonResponse
    {
        $employee = $this->employee($request->user());

        return ApiResponse::created(
            new EmployeeDocumentResource(
                $this->documents->upload($employee, $request->validated(), $request->file('file'), $request->user())
            ),
            'Document uploaded successfully'
        );
    }

    public function deleteDocument(Request $request, EmployeeDocument $document): JsonResponse
    {
        $employee = $this->employee($request->user());

        if ((int) $document->employee_id !== (int) $employee->id) {
            throw new ApiException('Document not found.', 404, 'NOT_FOUND');
        }

        $this->documents->delete($document, $request->user());

        return ApiResponse::success(null, 'Document deleted successfully');
    }

    private function employee(User $user): Employee
    {
        $employee = $user->employee;

        if ($employee === null) {
            throw new ApiException(
                'Documents need an employee record. Ask HR to onboard this account first.',
                422,
                'EMPLOYEE_RECORD_MISSING'
            );
        }

        return $employee;
    }
}
