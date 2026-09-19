<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Services\ReportService;
use App\Support\ApiResponse;
use App\Support\ReportCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends ApiController
{
    private const PREVIEW_ROWS = 100;

    public function __construct(private readonly ReportService $reports) {}

    public function index(): JsonResponse
    {
        return ApiResponse::success(
            ['reports' => ReportCatalog::listing()],
            'Reports fetched successfully'
        );
    }

    public function show(Request $request, string $report): JsonResponse
    {
        $built = $this->reports->build($this->companyId(), $report, $request->all());
        $rows = $built['rows'];

        return ApiResponse::success([
            'title' => $built['title'],
            'period' => $built['period'],
            'columns' => $built['columns'],
            'rows' => array_slice($rows, 0, self::PREVIEW_ROWS),
            'row_count' => $built['row_count'],
            'truncated' => $built['row_count'] > self::PREVIEW_ROWS,
            'generated_at' => $built['generated_at'],
        ], 'Report ready');
    }

    public function download(Request $request, string $report): StreamedResponse
    {
        $built = $this->reports->build($this->companyId(), $report, $request->all());

        $name = str_replace(' ', '-', $built['title'])
            . ($built['period'] === null ? '' : '-' . str_replace([' ', '/'], ['-', '-'], $built['period']))
            . '.csv';

        return response()->streamDownload(
            static function () use ($built): void {
                $handle = fopen('php://output', 'wb');

                // Excel UTF-8 tabhi sahi padhta hai jab BOM ho
                fwrite($handle, "\xEF\xBB\xBF");
                fputcsv($handle, $built['columns']);

                foreach ($built['rows'] as $row) {
                    fputcsv($handle, $row);
                }

                fclose($handle);
            },
            $name,
            ['Content-Type' => 'text/csv; charset=utf-8']
        );
    }

    private function companyId(): int
    {
        $id = $this->tenantId();

        if ($id === null) {
            throw new ApiException(
                'Report kisi company ki hoti hai. X-Company-Id header bhejo.',
                422,
                'TENANT_REQUIRED'
            );
        }

        return $id;
    }
}
