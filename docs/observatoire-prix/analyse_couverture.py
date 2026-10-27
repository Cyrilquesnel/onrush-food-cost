#!/usr/bin/env python3
"""Reproduire les effectifs publics de couverture, sans montants de catalogue."""
import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path


def summarise(rows):
    seen = set()
    sources = defaultdict(lambda: dict(targets=0, prices_observed=0, known_tax=0, unknown_tax=0))
    for row in rows:
        key = row['wave'], row['reference_id'], row['source_id']
        if key in seen:
            raise ValueError(f'Doublon de couverture : {key}')
        seen.add(key)
        if row['price_observed'] not in {'0', '1'}:
            raise ValueError('price_observed doit être 0 ou 1')
        if row['tax_basis'] not in {'HT', 'TTC', 'inconnue'}:
            raise ValueError('Base fiscale invalide')
        present = int(row['price_observed'])
        source = sources[row['source_id']]
        source['targets'] += 1
        source['prices_observed'] += present
        source['known_tax'] += present and row['tax_basis'] != 'inconnue'
        source['unknown_tax'] += present and row['tax_basis'] == 'inconnue'
    targets = len(rows)
    observed = sum(s['prices_observed'] for s in sources.values())
    known = sum(s['known_tax'] for s in sources.values())
    return dict(
        targets=targets, prices_observed=observed,
        missing_prices=targets-observed, known_tax=known,
        unknown_tax=sum(s['unknown_tax'] for s in sources.values()),
        coverage_pct=100*observed/targets if targets else None,
        tax_qualification_pct=100*known/targets if targets else None,
        waves=sorted({r['wave'] for r in rows}),
        sources=dict(sorted(sources.items())),
        scope='Effectifs de couverture uniquement; aucun montant de catalogue joint',
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', nargs='?', type=Path, default=Path(__file__).with_name('couverture-r1.csv'))
    args = parser.parse_args()
    with args.input.open(encoding='utf-8', newline='') as stream:
        rows = list(csv.DictReader(stream))
    print(json.dumps(summarise(rows), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
