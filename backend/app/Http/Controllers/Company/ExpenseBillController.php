<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Requests\ExpenseBillRequest;
use App\Http\Resources\ExpenseBillResource;
use App\Models\ExpenseBill;
use App\Models\ExpenseClaim;
use App\Services\ExpenseService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExpenseBillController extends ApiController
{
    public function __construct(private readonly ExpenseService $expenses) {}

    public function index(ExpenseClaim $claim): JsonResponse
    {
        return ApiResponse::success(
            ExpenseBillResource::collection($claim->bills()->with('uploader')->orderByDesc('id')->get()),
            'Bills fetched successfully'
        );
    }

    public function store(ExpenseBillRequest $request, ExpenseClaim $claim): JsonResponse
    {
        return ApiResponse::created(
            new ExpenseBillResource($this->expenses->addBill($claim, $request->file('bill'), $request->user())),
            'Bill uploaded'
        );
    }

    public function destroy(Request $request, ExpenseClaim $claim, ExpenseBill $bill): JsonResponse
    {
        $this->expenses->deleteBill($bill, $request->user());

        return ApiResponse::success(null, 'Bill removed');
    }

    public function download(Request $request, ExpenseBill $bill): StreamedResponse
    {
        $claim = ExpenseClaim::query()->visibleTo($request->user())->whereKey($bill->expense_claim_id)->first();

        if ($claim === null) {
            throw new ApiException('You cannot view this bill.', 404, 'RESOURCE_NOT_FOUND');
        }

        return $this->expenses->downloadBill($bill);
    }
}
