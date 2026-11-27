<?php

use App\Support\UnitDirectory;

beforeEach(function () {
    $this->units = new UnitDirectory(__DIR__.'/../../public/boundaries/units.json');
});

test('finds a ward by code', function () {
    expect($this->units->find('ward', 1448)['name'])->toBe('Ngei');
    expect($this->units->find('ward', 1451))->toBeNull();
});

test('lists ancestors nearest first', function () {
    expect(array_column($this->units->ancestors('ward', 1448), 'name'))->toBe(['Mathare', 'Nairobi City', 'Nairobi']);
});

test('lists children', function () {
    expect($this->units->children('county', 47))->toHaveCount(17);
    expect($this->units->children('ward', 1448))->toBe([]);
});
