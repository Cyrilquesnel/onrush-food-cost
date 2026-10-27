import unittest
from analyse_couverture import summarise


def row(reference='R01', **changes):
    return dict(wave='R1',reference_id=reference,source_id='S',price_observed='1',tax_basis='TTC')|changes


class CoverageTests(unittest.TestCase):
    def test_qualification_et_manquant(self):
        summary=summarise([row(),row('R02',tax_basis='inconnue'),row('R03',price_observed='0',tax_basis='inconnue')])
        self.assertEqual(summary['targets'],3)
        self.assertEqual(summary['prices_observed'],2)
        self.assertEqual(summary['known_tax'],1)
        self.assertEqual(summary['unknown_tax'],1)
        self.assertEqual(summary['missing_prices'],1)

    def test_doublon_refuse(self):
        with self.assertRaisesRegex(ValueError,'Doublon'):
            summarise([row(),row()])

    def test_presence_non_booleenne_refusee(self):
        with self.assertRaises(ValueError):
            summarise([row(price_observed='30')])

    def test_deux_sources_distinctes(self):
        summary=summarise([row(),row(source_id='AUTRE')])
        self.assertEqual(len(summary['sources']),2)
        self.assertEqual(summary['coverage_pct'],100)


if __name__=='__main__':
    unittest.main()
