<?php

namespace App\Http\Controllers;

use App\Support\PartyDirectory;
use App\Support\UnitDirectory;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A party's page is the map with its profile open (the counts come from /data/seats.json, like
 * every other number on the map), so the server only names the party and writes the page's title
 * and Open Graph tags.
 */
class PartyController extends Controller
{
    private const SITE = 'Kenya Electoral Map';

    public function __construct(private PartyDirectory $parties, private UnitDirectory $units) {}

    public function show(Request $request, string $abbrev): Response
    {
        $party = $this->parties->find($abbrev);
        abort_if($party === null, 404);

        $name = sprintf('%s (%s)', $party->name, $party->abbrev);
        $scope = $this->scope($request->query('in'));
        $in = $scope ? sprintf(' in %s', $scope['name']) : '';

        return Inertia::render('Map', [
            'unit' => null,
            'party' => ['abbrev' => $party->abbrev, 'name' => $party->name],
        ])->withViewData('meta', [
            'title' => sprintf('%s%s — %s', $name, $in, self::SITE),
            'description' => $scope
                ? sprintf('Seats held by %s%s: governor, senator, woman rep, MPs and MCAs, with sources.', $name, $in)
                : sprintf('Seats held by %s: governors, senators, woman reps, MPs and MCAs, with sources.', $name),
            // Always the lower-case address, whatever case the visitor typed.
            'url' => rtrim((string) config('app.url'), '/').'/party/'.strtolower($party->abbrev)
                .($scope ? sprintf('?in=%s-%d', $scope['level'], $scope['code']) : ''),
        ]);
    }

    /**
     * The county or constituency a link's `?in=county-47` names, if it is one of ours; anything
     * else means all of Kenya.
     *
     * @return array{level: string, code: int, name: string}|null
     */
    private function scope(mixed $in): ?array
    {
        if (! is_string($in) || ! preg_match('/^(county|constituency)-([1-9][0-9]*)$/', $in, $m)) {
            return null;
        }
        $unit = $this->units->find($m[1], (int) $m[2]);

        return $unit ? ['level' => $m[1], 'code' => $unit['code'], 'name' => $unit['name']] : null;
    }
}
