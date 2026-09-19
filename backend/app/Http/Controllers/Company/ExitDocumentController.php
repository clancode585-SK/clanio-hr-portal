<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\ExitDocumentRequest;
use App\Http\Resources\ExitDocumentResource;
use App\Models\EmployeeExit;
use App\Models\ExitDocument;
use App\Services\ExitLetterService;
use App\Services\ExitService;
use App\Support\ApiResponse;
use App\Support\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExitDocumentController extends ApiController
{
    public function __construct(
        private readonly ExitService $exits,
        private readonly ExitLetterService $letters
    ) {}

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

    public function generate(Request $request, EmployeeExit $exit): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'string', 'in:experience_letter,relieving_letter,recommendation_letter,no_dues'],
            'issued_on' => ['nullable', 'date'],
            'body' => ['nullable', 'string', 'max:4000'],
            'remarks' => ['nullable', 'string', 'max:500'],
            'signatory_name' => ['nullable', 'string', 'max:150'],
            'signatory_designation' => ['nullable', 'string', 'max:150'],
        ]);

        return ApiResponse::created(
            new ExitDocumentResource($this->letters->generate($exit, $data, $request->user())),
            'Letter ban gaya — preview dekh kar bhej do'
        );
    }

    public function preview(ExitDocument $document): Response
    {
        return Pdf::show($this->letters->pdf($document), $this->letters->fileName($document));
    }

    public function download(ExitDocument $document): StreamedResponse
    {
        if ($document->source === ExitLetterService::GENERATED) {
            return Pdf::send($this->letters->pdf($document), $this->letters->fileName($document));
        }

        return $this->exits->downloadDocument($document);
    }

    public function destroy(Request $request, EmployeeExit $exit, ExitDocument $document): JsonResponse
    {
        $this->exits->deleteDocument($document, $request->user());

        return ApiResponse::success(null, 'Document hata diya gaya');
    }
}
