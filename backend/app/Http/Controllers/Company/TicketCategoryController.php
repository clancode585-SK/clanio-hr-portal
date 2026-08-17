<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\TicketCategoryRequest;
use App\Http\Resources\TicketCategoryResource;
use App\Models\TicketCategory;
use App\Services\TicketCategoryService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TicketCategoryController extends ApiController
{
    public function __construct(private readonly TicketCategoryService $categories) {}

    public function index(Request $request): JsonResponse
    {
        return ApiResponse::success(
            TicketCategoryResource::collection(
                $this->categories->listFor($request->user(), $request->string('scope')->toString() ?: null)
            ),
            'Ticket categories fetched successfully'
        );
    }

    public function store(TicketCategoryRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new TicketCategoryResource($this->categories->create($request->validated(), $request->user(), $this->tenantId())),
            'Category ban gayi'
        );
    }

    public function show(TicketCategory $category): JsonResponse
    {
        return ApiResponse::success(
            new TicketCategoryResource($category->load(['routes.department', 'routes.user'])),
            'Category details fetched successfully'
        );
    }

    public function update(TicketCategoryRequest $request, TicketCategory $category): JsonResponse
    {
        return ApiResponse::success(
            new TicketCategoryResource($this->categories->update($category, $request->validated(), $request->user())),
            'Category update ho gayi'
        );
    }

    public function destroy(Request $request, TicketCategory $category): JsonResponse
    {
        $this->categories->delete($category, $request->user());

        return ApiResponse::success(null, 'Category band kar di gayi');
    }
}
