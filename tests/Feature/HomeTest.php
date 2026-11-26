<?php

test('the home page loads', function () {
    $this->get('/')->assertOk();
});
