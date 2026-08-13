<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\RecognitionRequest;
use App\Http\Resources\RecognitionResource;
use App\Models\Recognition;
use App\Services\RecognitionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecognitionController extends ApiController
{
    public function __construct(private readonly RecognitionService $recognitions) {}

    public function types(): JsonResponse
    {
        $types = [];

        foreach (Recognition::TYPES as $value => $label) {
            $types[] = ['value' => $value, 'label' => $label];
        }

        return ApiResponse::success(['types' => $types], 'Recognition types fetched successfully');
    }

    public function index(Request $request): JsonResponse
    {
        $recognitions = $this->applyFilters(
            Recognition::query()
                ->with('employee.user', 'giver')
                ->visibleTo($request->user()),
            $request,
            ['title', 'message'],
            ['type' => 'type', 'employee_id' => 'employee_id']
        )->orderByDesc('awarded_on')->orderByDesc('id')->paginate($this->perPage($request));

        return ApiResponse::paginated($recognitions, RecognitionResource::class, 'Recognitions fetched successfully');
    }

    public function summary(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->recognitions->summary(
                $request->user(),
                $request->filled('employee_id') ? (int) $request->input('employee_id') : null
            ),
            'Recognition summary fetched successfully'
        );
    }

    public function store(RecognitionRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new RecognitionResource($this->recognitions->give($request->validated(), $request->user())),
            'Recognition de di gayi'
        );
    }

    public function show(Recognition $recognition): JsonResponse
    {
        return ApiResponse::success(
            new RecognitionResource($recognition->load('employee.user', 'giver')),
            'Recognition fetched successfully'
        );
    }

    public function destroy(Request $request, Recognition $recognition): JsonResponse
    {
        $this->recognitions->delete($recognition, $request->user());

        return ApiResponse::success(null, 'Recognition hata di gayi');
    }
}
