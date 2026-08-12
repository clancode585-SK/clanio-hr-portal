<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\EmployeeExit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class EmployeeExitResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $actor = $request->user();
        $isOwner = (int) $this->employee?->user_id === (int) $actor?->id;
        $canApprove = (bool) $actor?->hasPermission(EmployeeExit::APPROVE_PERMISSION);

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'employee_id' => (int) $this->employee_id,
            'employee_name' => $this->employee?->user?->name,
            'employee_code' => $this->employee?->employee_code,
            'date_of_joining' => $this->employee?->date_of_joining?->format('Y-m-d'),

            'exit_type' => $this->exit_type,
            'exit_type_label' => $this->typeLabel(),
            'reason' => $this->reason,

            'resignation_date' => $this->resignation_date?->format('Y-m-d'),
            'requested_last_working_date' => $this->requested_last_working_date?->format('Y-m-d'),
            'notice_period_days' => $this->notice_period_days,
            'last_working_date' => $this->last_working_date?->format('Y-m-d'),
            'days_left' => $this->daysLeft(),

            'status' => $this->status,
            'stage' => $this->stageLabel(),
            'is_closed' => $this->isClosed(),

            'manager' => [
                'manager_id' => $this->manager_id === null ? null : (int) $this->manager_id,
                'manager_name' => $this->manager?->name,
                'decided_at' => $this->manager_decided_at,
                'remarks' => $this->manager_remarks,
            ],
            'hr' => [
                'hr_id' => $this->hr_id === null ? null : (int) $this->hr_id,
                'hr_name' => $this->hr?->name,
                'decided_at' => $this->hr_decided_at,
                'remarks' => $this->hr_remarks,
            ],
            'rejection' => $this->status !== EmployeeExit::REJECTED ? null : [
                'stage' => $this->rejected_stage,
                'reason' => $this->reject_reason,
                'rejected_at' => $this->rejected_at,
            ],

            'withdrawn_at' => $this->withdrawn_at,
            'exited_at' => $this->exited_at,
            'clearance_forced_by' => $this->clearance_forced_by === null ? null : (int) $this->clearance_forced_by,
            'clearance_force_reason' => $this->clearance_force_reason,
            'clearance' => $this->when(
                $this->relationLoaded('clearances'),
                fn (): array => $this->clearanceSummary()
            ),

            'document_count' => $this->whenCounted('documents'),
            'documents' => ExitDocumentResource::collection($this->whenLoaded('documents')),

            'can' => [
                'withdraw' => $isOwner && in_array($this->status, [EmployeeExit::PENDING, EmployeeExit::MANAGER_APPROVED], true),
                'manager_approve' => $this->isPending() && ! $isOwner,
                'hr_approve' => $this->isManagerApproved() && $canApprove,
                'change_date' => $this->isServingNotice() && $canApprove,
                'complete' => $this->isServingNotice() && $canApprove,
                'issue_documents' => ($this->isServingNotice() || $this->isExited())
                    && (bool) $actor?->hasPermission(EmployeeExit::DOCUMENT_PERMISSION),
            ],

            'created_at' => $this->created_at,
        ];
    }

    private function clearanceSummary(): array
    {
        $items = $this->clearances;
        $total = $items->count();
        $done = $items->whereIn('status', ['cleared', 'not_applicable'])->count();
        $open = $items->filter(fn ($item): bool => $item->blocksExit())->count();

        return [
            'total' => $total,
            'cleared' => $items->where('status', 'cleared')->count(),
            'pending' => $items->where('status', 'pending')->count(),
            'blocked' => $items->where('status', 'blocked')->count(),
            'open_mandatory' => $open,
            'is_complete' => $total === 0 || $open === 0,
            'progress_percent' => $total === 0 ? 100 : (int) round($done / $total * 100),
            'recoverable_amount' => round((float) $items->sum('recoverable_amount'), 2),
        ];
    }

    private function daysLeft(): ?int
    {
        if ($this->last_working_date === null || ! $this->isServingNotice()) {
            return null;
        }

        return (int) round(Carbon::today()->diffInDays($this->last_working_date, false));
    }
}
