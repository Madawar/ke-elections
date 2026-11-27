<?php

namespace App\Http\Controllers;

use App\Support\UnitDirectory;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MapController extends Controller
{
    private const SITE = 'Kenya Electoral Map';

    public function __construct(private UnitDirectory $units) {}

    public function home(Request $request): Response
    {
        return Inertia::render('Map', ['unit' => null])->withViewData('meta', [
            'title' => self::SITE,
            'description' => 'Every county, constituency and ward in Kenya, with the seats they elect.',
            'url' => $this->canonicalUrl($request),
        ]);
    }

    public function unit(Request $request, string $level, string $code): Response
    {
        $unit = $this->units->find($level, (int) $code);
        abort_if($unit === null || (string) (int) $code !== $code, 404);

        $ancestors = $this->units->ancestors($level, $unit['code']);
        $pick = fn (array $u) => ['level' => $u['level'], 'code' => $u['code'], 'name' => $u['name']];
        $byLevel = collect($ancestors)->keyBy('level');

        $place = match ($level) {
            'ward' => sprintf('%s ward, %s constituency, %s county.', $unit['name'], $byLevel['constituency']['name'], $byLevel['county']['name']),
            'constituency' => sprintf('%s constituency, %s county.', $unit['name'], $byLevel['county']['name']),
            default => sprintf('%s county, %s.', $unit['name'], $byLevel['province']['name'] ?? 'Kenya'),
        };

        return Inertia::render('Map', [
            'unit' => [...$pick($unit), 'ancestors' => array_map($pick, $ancestors)],
        ])->withViewData('meta', [
            'title' => sprintf('%s %s — %s', $unit['name'], ucfirst($level), self::SITE),
            'description' => $place.' Seats, office holders and 2027 nominations.',
            'url' => $this->canonicalUrl($request),
        ]);
    }

    /** og:url / canonical from config('app.url'), never the request's Host header. */
    private function canonicalUrl(Request $request): string
    {
        $path = trim($request->path(), '/');

        return rtrim((string) config('app.url'), '/').'/'.$path;
    }
}
