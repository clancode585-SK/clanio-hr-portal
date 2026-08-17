<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Services\OrgChartService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrgChartController extends ApiController
{
    public function __construct(private readonly OrgChartService $orgChart) {}

    public function index(Request $request): JsonResponse
    {
        $companyId = $this->tenantId();

        if ($companyId === null) {
            return ApiResponse::error('Company context nahi mila', 400, 'TENANT_MISSING');
        }

        $depth = $request->string('depth', OrgChartService::DEPTH_EMPLOYEE)->toString();

        if (! in_array($depth, OrgChartService::DEPTHS, true)) {
            return ApiResponse::error(
                'Depth galat hai, sirf ye chalega: ' . implode(', ', OrgChartService::DEPTHS),
                422,
                'VALIDATION_FAILED',
                ['depth' => ['Depth galat hai']]
            );
        }

        return ApiResponse::success(
            $this->orgChart->build(
                $companyId,
                $request->filled('branch_id') ? $request->integer('branch_id') : null,
                $depth,
                $request->boolean('include_exited')
            ),
            'Org chart fetched successfully'
        );
    }
}
