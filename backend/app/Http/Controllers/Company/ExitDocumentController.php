<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\ExitDocumentRequest;
use App\Http\Resources\ExitDocumentResource;
use App\Models\EmployeeExit;
use App\Models\ExitDocument;
use App\Services\ExitService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExitDocumentController extends ApiController
{
    public function __construct(private readonly ExitService $exits) {}

    public function index(EmployeeExit $exit): JsonResponse
    {
        return ApiResponse::success(
            ExitDocumentResource::collection($exit->documents()->with('uploader')->latest('id')->get()),
            'Exit documents fetched successfully'
        );
    }

    public function store(ExitDocumentRequest $request, EmployeeExit $exit): JsonResponse
    {
        return ApiResponse::created(
            new ExitDocumentResource(
                $this->exits->addDocument($exit, $request->validated(), $request->file('file'), $request->user())
            ),
            'Document issue ho gaya'
        );
    }

    public function download(ExitDocument $document): StreamedResponse
    {
        return $this->exits->downloadDocument($document);
    }

    public function destroy(Request $request, EmployeeExit $exit, ExitDocument $document): JsonResponse
    {
        $this->exits->deleteDocument($document, $request->user());

        return ApiResponse::success(null, 'Document hata diya gaya');
    }
}
