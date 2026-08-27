import { describe, it, expect } from 'bun:test';
import { SearchResult } from '@/lib/types';
import { toSlug } from '@/lib/slugify';

describe('Search & Alias Logic Helpers', () => {
  it('should generate canonical URLs for alias search results', () => {
    const res: SearchResult = {
      Marque: 'Chery',
      Famille: 'Tiggo 7',
      Modele: 'Tiggo 7',
      Type: 'model',
      MaxMY: 2024,
      DisplayName: 'Ebro S700 (Chery Tiggo 7)',
      CanonicalMarque: 'Chery',
      CanonicalFamille: 'Tiggo 7',
      CanonicalModele: 'Tiggo 7',
    };

    const targetMarque = res.CanonicalMarque || res.Marque;
    const targetFamille = res.CanonicalFamille || res.Famille;
    const targetModele = res.CanonicalModele || res.Modele;

    const url = `/${toSlug(targetMarque)}/${toSlug(targetFamille)}/${res.MaxMY}/${toSlug(targetModele)}`;
    expect(url).toBe('/chery/tiggo-7/2024/tiggo-7');
  });

  it('should fall back to Marque/Famille/Modele when Canonical fields are missing', () => {
    const res: SearchResult = {
      Marque: 'Chery',
      Famille: 'Tiggo 7',
      Modele: 'Tiggo 7',
      Type: 'model',
      MaxMY: 2024,
      DisplayName: null,
    };

    const targetMarque = res.CanonicalMarque || res.Marque;
    const targetFamille = res.CanonicalFamille || res.Famille;
    const targetModele = res.CanonicalModele || res.Modele;

    const url = `/${toSlug(targetMarque)}/${toSlug(targetFamille)}/${res.MaxMY}/${toSlug(targetModele)}`;
    expect(url).toBe('/chery/tiggo-7/2024/tiggo-7');
  });

  it('should format DisplayName vs Standard Name correctly', () => {
    const aliasRes: SearchResult = {
      Marque: 'Chery',
      Famille: 'Tiggo 7',
      Modele: 'Tiggo 7',
      Type: 'model',
      MaxMY: 2024,
      DisplayName: 'Ora Funky Cat (GWM Ora 03)',
      CanonicalMarque: 'GWM',
      CanonicalFamille: 'Ora 03',
      CanonicalModele: 'Ora 03',
    };

    const displayTitle = aliasRes.DisplayName || `${aliasRes.Marque} ${aliasRes.Famille}`;
    expect(displayTitle).toBe('Ora Funky Cat (GWM Ora 03)');
  });
});
