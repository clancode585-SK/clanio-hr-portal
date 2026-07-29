<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Requests\DocumentVerifyRequest;
use App\Http\Requests\EmployeeDocumentRequest;
use App\Http\Resources\EmployeeDocumentResource;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Services\EmployeeDocumentService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EmployeeDocumentController extends ApiController
{
    public function __construct(private readonly EmployeeDocumentService $documents) {}

    public function index(Request $request, Employee $employee): JsonResponse
    {
        $documents = $employee->documents()
            ->with('verifier')
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->latest('id')
            ->get();

        return ApiResponse::success(
            EmployeeDocumentResource::collection($documents),
            'Documents fetched successfully'
        );
    }

    public function store(EmployeeDocumentRequest $request, Employee $employee): JsonResponse
    {
        return ApiResponse::created(
            new EmployeeDocumentResource(
                $this->documents->upload($employee, $request->validated(), $request->file('file'), $request->user())
            ),
            'Document uploaded successfully'
        );
    }

    public function show(Employee $employee, EmployeeDocument $document): JsonResponse
    {
        return ApiResponse::success(
            new EmployeeDocumentResource($document->load('verifier')),
            'Document details fetched successfully'
        );
    }

    public function verify(DocumentVerifyRequest $request, Employee $employee, EmployeeDocument $document): JsonResponse
    {
        return ApiResponse::success(
            new EmployeeDocumentResource($this->documents->verify($document, $request->validated(), $request->user())),
            'Document ' . $request->validated('status') . ' successfully'
        );
    }

    public function destroy(Request $request, Employee $employee, EmployeeDocument $document): JsonResponse
    {
        $this->documents->delete($document, $request->user());

        return ApiResponse::success(null, 'Document deleted successfully');
    }

    public function download(Request $request, EmployeeDocument $document): StreamedResponse
    {
        if (! $this->documents->readable($document, $request->user())) {
            throw new ApiException('Document not found.', 404, 'NOT_FOUND');
        }

        return $this->documents->download($document);
    }
}
