<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Services\StatutoryReturnService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StatutoryReturnController extends ApiController
{
    private const RETURNS = [
        'pf-ecr' => [
            'label' => 'PF ECR',
            'hint' => 'EPFO ka Electronic Challan cum Return — 11 field, #~# se alag',
            'param' => 'month',
            'format' => 'txt',
        ],
        'esi-return' => [
            'label' => 'ESI Monthly Contribution',
            'hint' => 'ESIC portal par upload karne wali contribution file',
            'param' => 'month',
            'format' => 'csv',
        ],
        'tds-24q' => [
            'label' => 'Form 24Q Annexure I',
            'hint' => 'Quarter ki deductee detail — RPU me import karne ke liye',
            'param' => 'quarter',
            'format' => 'csv',
        ],
    ];

    public function __construct(private readonly StatutoryReturnService $returns) {}

    public function index(): JsonResponse
    {
        $out = [];

        foreach (self::RETURNS as $key => $row) {
            $out[] = ['key' => $key] + $row;
        }

        return ApiResponse::success(['returns' => $out], 'Statutory returns fetched successfully');
    }

    public function show(Request $request, string $return): JsonResponse
    {
        $built = $this->build($request, $return);

        return ApiResponse::success([
            'title' => $built['title'],
            'period' => $built['period'],
            'format' => $built['format'],
            'file_name' => $built['file_name'],
            'columns' => $built['columns'] ?? null,
            'rows' => array_slice($built['rows'] ?? [], 0, 100),
            'lines' => array_slice($built['lines'] ?? [], 0, 100),
            'row_count' => $built['row_count'],
            'truncated' => $built['row_count'] > 100,
            'skipped' => $built['skipped'],
            'totals' => $built['totals'],
            'establishment_code' => $built['establishment_code'],
        ], 'Return ready');
    }

    public function download(Request $request, string $return): StreamedResponse
    {
        $built = $this->build($request, $return);

        if ($built['format'] === 'txt') {
            $body = $built['content'];

            return response()->streamDownload(
                static function () use ($body): void {
                    echo $body;
                },
                $built['file_name'],
                ['Content-Type' => 'text/plain; charset=utf-8']
            );
        }

        return response()->streamDownload(
            static function () use ($built): void {
                $handle = fopen('php://output', 'wb');

                fwrite($handle, "\xEF\xBB\xBF");
                fputcsv($handle, $built['columns']);

                foreach ($built['rows'] as $row) {
                    fputcsv($handle, $row);
                }

                fclose($handle);
            },
            $built['file_name'],
            ['Content-Type' => 'text/csv; charset=utf-8']
        );
    }

    private function build(Request $request, string $return): array
    {
        if (! array_key_exists($return, self::RETURNS)) {
            throw new ApiException('Ye return nahi mila.', 404, 'RETURN_UNKNOWN');
        }

        $companyId = $this->companyId();

        if ($return === 'tds-24q') {
            $data = $request->validate([
                'quarter' => ['required', 'string', 'in:Q1,Q2,Q3,Q4'],
                'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            ]);

            return $this->returns->tds24q($companyId, $data['quarter'], (int) $data['year']);
        }

        $data = $request->validate([
            'month' => ['required', 'string', 'regex:/^\d{4}-\d{2}$/'],
        ]);

        return $return === 'pf-ecr'
            ? $this->returns->ecr($companyId, $data['month'])
            : $this->returns->esi($companyId, $data['month']);
    }

    private function companyId(): int
    {
        $id = $this->tenantId();

        if ($id === null) {
            throw new ApiException(
                'Return kisi company ka hota hai. X-Company-Id header bhejo.',
                422,
                'TENANT_REQUIRED'
            );
        }

        return $id;
    }
}
