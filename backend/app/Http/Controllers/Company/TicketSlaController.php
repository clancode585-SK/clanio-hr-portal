<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Requests\TicketSlaRequest;
use App\Models\Ticket;
use App\Models\TicketSla;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;

class TicketSlaController extends ApiController
{
    private const FALLBACK = [
        'urgent' => [1, 4],
        'high' => [4, 24],
        'medium' => [8, 48],
        'low' => [24, 120],
    ];

    public function index(): JsonResponse
    {
        return ApiResponse::success($this->current(), 'Ticket response times fetched successfully');
    }

    public function update(TicketSlaRequest $request): JsonResponse
    {
        $companyId = $this->tenantId();

        if ($companyId === null) {
            throw new ApiException(
                'Response times belong to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        foreach ($request->validated()['slas'] as $row) {
            TicketSla::query()->updateOrCreate(
                ['company_id' => $companyId, 'priority' => $row['priority']],
                [
                    'response_hours' => (int) $row['response_hours'],
                    'resolution_hours' => (int) $row['resolution_hours'],
                ]
            );
        }

        TenantCache::flush(TenantCache::TICKETS);

        return ApiResponse::success($this->current(), 'Ticket response times updated successfully');
    }

    private function current(): array
    {
        $saved = TicketSla::query()->get()->keyBy('priority');

        return array_map(function (string $priority) use ($saved): array {
            $row = $saved->get($priority);

            return [
                'priority' => $priority,
                'label' => ucfirst($priority),
                'response_hours' => (int) ($row->response_hours ?? self::FALLBACK[$priority][0]),
                'resolution_hours' => (int) ($row->resolution_hours ?? self::FALLBACK[$priority][1]),
                'is_default' => $row === null,
            ];
        }, array_reverse(Ticket::PRIORITIES));
    }
}
