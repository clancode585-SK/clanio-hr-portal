<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\ExpenseClaim;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExpenseClaimResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $actor = $request->user();

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'employee_id' => (int) $this->employee_id,
            'employee_name' => $this->employee?->user?->name,
            'employee_code' => $this->employee?->employee_code,

            'category' => $this->category,
            'category_label' => $this->categoryLabel(),
            'purpose' => $this->purpose,
            'expense_date' => $this->expense_date,
            'amount' => $this->amount,
            'approved_amount' => $this->approved_amount,
            'payable_amount' => $this->payable(),
            'description' => $this->description,

            'status' => $this->status,
            'stage' => $this->stageLabel(),
            'is_closed' => $this->isClosed(),

            'manager' => [
                'approver_id' => $this->approver_id === null ? null : (int) $this->approver_id,
                'approver_name' => $this->approver?->name,
                'approved_at' => $this->approved_at,
                'remarks' => $this->approver_remarks,
            ],
            'hr' => [
                'verified_by' => $this->verified_by === null ? null : (int) $this->verified_by,
                'verifier_name' => $this->verifier?->name,
                'verified_at' => $this->verified_at,
                'remarks' => $this->verify_remarks,
            ],
            'payment' => [
                'paid_by' => $this->paid_by === null ? null : (int) $this->paid_by,
                'payer_name' => $this->payer?->name,
                'paid_on' => $this->paid_on,
                'mode' => $this->payment_mode,
                'reference' => $this->payment_reference,
                'remarks' => $this->payment_remarks,
            ],
            'rejection' => $this->status !== ExpenseClaim::REJECTED ? null : [
                'stage' => $this->rejected_stage,
                'reason' => $this->reject_reason,
                'rejected_at' => $this->rejected_at,
            ],

            'bill_count' => $this->whenCounted('bills'),
            'bills' => ExpenseBillResource::collection($this->whenLoaded('bills')),

            'can' => [
                'edit' => $this->isPending() && (int) $this->employee?->user_id === (int) $actor?->id,
                'cancel' => $this->isPending() && (int) $this->employee?->user_id === (int) $actor?->id,
                'approve' => $this->isPending() && (int) $this->employee?->user_id !== (int) $actor?->id,
                'verify' => $this->isManagerApproved() && (bool) $actor?->hasPermission(ExpenseClaim::VERIFY_PERMISSION),
                'pay' => $this->isVerified() && (bool) $actor?->hasPermission(ExpenseClaim::PAY_PERMISSION),
            ],

            'created_at' => $this->created_at,
        ];
    }
}
