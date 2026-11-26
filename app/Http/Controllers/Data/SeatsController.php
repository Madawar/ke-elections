<?php

namespace App\Http\Controllers\Data;

use App\Enums\Seat;
use App\Models\ImportBatch;
use App\Models\OfficeHolder;
use App\Models\Party;
use Illuminate\Http\JsonResponse;
use stdClass;

/**
 * GET /data/seats.json: current office holders, parties and seat/chamber totals for the
 * public map. Public and cacheable. Independents are reported under the party "IND".
 * Chamber counts exclude the Speakers (they are not office_holders seats).
 */
class SeatsController
{
    public function __invoke(): JsonResponse
    {
        $parties = Party::query()->orderBy('abbrev')->get();

        /** @var array<int, string> $abbrevById */
        $abbrevById = [];
        $partyList = [];
        foreach ($parties as $p) {
            $abbrevById[$p->id] = $p->abbrev;
            $partyList[] = [
                'abbrev' => $p->abbrev,
                'name' => $p->name,
                'coalition_2022' => $p->coalition_2022,
                'colour' => $p->display_colour,
            ];
        }

        $seatOrder = implode(',', array_fill(0, count(Seat::values()), '?'));
        $current = OfficeHolder::query()->whereNull('ended_on')
            ->orderByRaw("FIELD(seat, {$seatOrder})", Seat::values())
            ->orderBy('unit_level')->orderBy('unit_code')->orderBy('holder_name')
            ->get();

        $holders = [];
        /** @var array<string, array<string, int>> $bySeat seat => party => count */
        $bySeat = array_fill_keys(Seat::values(), []);
        foreach ($current as $h) {
            $party = $h->party_id === null ? Party::INDEPENDENT : $abbrevById[$h->party_id];
            $holders[] = [
                'seat' => $h->seat,
                'level' => $h->unit_level,
                'code' => $h->unit_code,
                'name' => $h->holder_name,
                'party' => $party,
                'basis' => $h->basis,
                'started_on' => $h->started_on->format('Y-m-d'),
                'source_url' => $h->source_url,
                'confidence' => $h->confidence,
            ];
            $bySeat[$h->seat][$party] = ($bySeat[$h->seat][$party] ?? 0) + 1;
        }

        if (array_filter($bySeat, fn (array $counts) => isset($counts[Party::INDEPENDENT])) !== []) {
            $partyList[] = ['abbrev' => Party::INDEPENDENT, 'name' => 'Independent', 'coalition_2022' => null, 'colour' => null];
        }

        $totals = [];
        foreach ($bySeat as $seat => $counts) {
            $totals[$seat] = $this->counts([$counts]);
        }

        $chamber = fn (array $seats) => $this->counts(array_map(fn (Seat $s) => $bySeat[$s->value], $seats));

        $asOf = ImportBatch::query()->whereIn('kind', ['holders', 'parties'])->max('imported_at');
        $dataAsOf = max(OfficeHolder::query()->max('started_on'), OfficeHolder::query()->max('ended_on'));

        return response()->json([
            'as_of' => $asOf ? substr((string) $asOf, 0, 10) : null,
            'data_as_of' => $dataAsOf ? substr((string) $dataAsOf, 0, 10) : null,
            'parties' => $partyList,
            'holders' => $holders,
            'totals' => $totals,
            'chambers' => [
                'national_assembly' => $chamber(Seat::nationalAssembly()),
                'senate' => $chamber(Seat::senate()),
            ],
        ]);
    }

    /**
     * Sum party counts, largest first; an empty object (not a JSON array) when there are none.
     *
     * @param  array<array<string, int>>  $groups
     * @return array<string, int>|stdClass
     */
    private function counts(array $groups): array|stdClass
    {
        $sum = [];
        foreach ($groups as $counts) {
            foreach ($counts as $party => $n) {
                $sum[$party] = ($sum[$party] ?? 0) + $n;
            }
        }
        arsort($sum);

        return $sum === [] ? new stdClass : $sum;
    }
}
