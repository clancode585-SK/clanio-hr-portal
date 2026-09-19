<?php

declare(strict_types=1);

namespace App\Support;

use Barryvdh\DomPDF\Facade\Pdf as Dompdf;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Har document — payslip, Form 16, letter — yahin se PDF banta hai.
 * HTML kahin bahar nahi jaata.
 */
final class Pdf
{
    /** PDF font me ye glyph nahi hai — box ki jagah saaf text */
    private const SWAPS = ["\u{20B9}" => 'Rs. '];

    public static function bytes(string $view, array $data, string $orientation = 'portrait'): string
    {
        return self::fromHtml(view($view, $data)->render(), $orientation);
    }

    public static function fromHtml(string $html, string $orientation = 'portrait'): string
    {
        return self::stamp(
            Dompdf::setOptions(self::options())
                ->loadHTML(strtr($html, self::SWAPS))
                ->setPaper('a4', $orientation)
        );
    }

    /** Browser me khulega, download nahi hoga */
    public static function inline(string $view, array $data, string $fileName, string $orientation = 'portrait'): Response
    {
        return self::show(self::bytes($view, $data, $orientation), $fileName);
    }

    public static function download(string $view, array $data, string $fileName, string $orientation = 'portrait'): StreamedResponse
    {
        return self::send(self::bytes($view, $data, $orientation), $fileName);
    }

    public static function show(string $bytes, string $fileName): Response
    {
        return new Response($bytes, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $fileName . '"',
            'Content-Length' => (string) strlen($bytes),
        ]);
    }

    public static function send(string $bytes, string $fileName, array $extra = []): StreamedResponse
    {
        return response()->streamDownload(
            static function () use ($bytes): void {
                echo $bytes;
            },
            $fileName,
            array_merge([
                'Content-Type' => 'application/pdf',
                'Content-Length' => (string) strlen($bytes),
            ], $extra)
        );
    }

    /** Page number dompdf ke canvas se lagta hai — CSS counter total nahi bata pata */
    private static function stamp($pdf): string
    {
        $dom = $pdf->getDomPDF();
        $dom->render();

        $canvas = $dom->getCanvas();
        $font = $dom->getFontMetrics()->getFont('DejaVu Sans', 'normal');

        $canvas->page_text(
            30,
            $canvas->get_height() - 28,
            'Page {PAGE_NUM} of {PAGE_COUNT}',
            $font,
            6.8,
            [0.60, 0.65, 0.69]
        );

        return (string) $dom->output();
    }

    private static function options(): array
    {
        return [
            'isRemoteEnabled' => false,
            'isHtml5ParserEnabled' => true,
            'isPhpEnabled' => false,
            'defaultFont' => 'DejaVu Sans',
            'dpi' => 96,
            'defaultPaperSize' => 'a4',
        ];
    }
}
