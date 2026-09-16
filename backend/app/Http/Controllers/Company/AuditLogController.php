<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $logs = $this->scoped()
            ->with('user')
            ->when($request->filled('event'), fn (Builder $query): Builder => $query->where('event', $request->string('event')->toString()))
            ->when($request->filled('entity'), fn (Builder $query): Builder => $query->where('auditable_type', $request->string('entity')->toString()))
            ->when($request->filled('entity_id'), fn (Builder $query): Builder => $query->where('auditable_id', $request->integer('entity_id')))
            ->when($request->filled('actor_id'), fn (Builder $query): Builder => $query->where('user_id', $request->integer('actor_id')))
            ->when($request->filled('from'), fn (Builder $query): Builder => $query->whereDate('created_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn (Builder $query): Builder => $query->whereDate('created_at', '<=', $request->date('to')))
            ->latest('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($logs, AuditLogResource::class, 'Audit log fetched successfully');
    }

    public function show(int $log): JsonResponse
    {
        $entry = $this->scoped()->with('user')->findOrFail($log);

        return ApiResponse::success(new AuditLogResource($entry), 'Audit entry fetched successfully');
    }

    public function filters(): JsonResponse
    {
        $entities = $this->scoped()
            ->selectRaw('auditable_type, COUNT(*) AS total')
            ->groupBy('auditable_type')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row): array => [
                'value' => $row->auditable_type,
                'label' => trim((string) preg_replace('/(?<!^)[A-Z]/', ' $0', (string) $row->auditable_type)),
                'total' => (int) $row->total,
            ])
            ->all();

        $events = $this->scoped()
            ->selectRaw('event, COUNT(*) AS total')
            ->groupBy('event')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row): array => [
                'value' => $row->event,
                'label' => ucfirst((string) $row->event),
                'total' => (int) $row->total,
            ])
            ->all();

        $actors = $this->scoped()
            ->with('user')
            ->whereNotNull('user_id')
            ->selectRaw('user_id, COUNT(*) AS total')
            ->groupBy('user_id')
            ->orderByDesc('total')
            ->limit(50)
            ->get()
            ->filter(fn ($row): bool => $row->user !== null)
            ->map(fn ($row): array => [
                'value' => $row->user_id,
                'label' => (string) $row->user->name,
                'total' => (int) $row->total,
            ])
            ->values()
            ->all();

        return ApiResponse::success([
            'entities' => $entities,
            'events' => $events,
            'actors' => $actors,
            'total' => $this->scoped()->count(),
        ], 'Audit log filters fetched successfully');
    }

    private function scoped(): Builder
    {
        $companyId = $this->tenantId();

        return AuditLog::query()->when(
            $companyId === null,
            fn (Builder $query): Builder => $query->whereNull('company_id'),
            fn (Builder $query): Builder => $query->where('company_id', $companyId)
        );
    }
}
