import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('next/font/google', () => ({
  DM_Sans: () => ({ variable: '--font-dm-sans' }),
  Inter: () => ({ variable: '--font-inter' }),
}));
import { metadata as rootMetadata } from '../app/layout';
import { metadata as homeMetadata } from '../app/page';
import { metadata as memberMetadata } from '../app/member/layout';

describe('Head & SEO Specifications', () => {
  describe('Dynamic Title Configuration', () => {
    it('root layout defines default title and template', () => {
      expect(rootMetadata.title).toBeDefined();
      expect(typeof rootMetadata.title).toBe('object');
      if (typeof rootMetadata.title === 'object' && rootMetadata.title !== null) {
        expect('default' in rootMetadata.title).toBe(true);
        expect('template' in rootMetadata.title).toBe(true);
        expect((rootMetadata.title as { template: string }).template).toBe('%s | Spotter');
      }
    });

    it('marketing page specifies homepage title', () => {
      expect(homeMetadata.title).toBe('Spotter | Approved Gym Records');
    });

    it('member route specifies member portal title', () => {
      expect(memberMetadata.title).toBe('Member Portal');
    });
  });

  describe('4-Word Description', () => {
    it('root layout description contains exactly 4 words', () => {
      const description = rootMetadata.description as string;
      expect(description).toBeDefined();
      const words = description.trim().split(/\s+/);
      expect(words.length).toBe(4);
      expect(description).toBe('Approved gym member records');
    });

    it('marketing page description contains exactly 4 words', () => {
      const description = homeMetadata.description as string;
      expect(description).toBeDefined();
      const words = description.trim().split(/\s+/);
      expect(words.length).toBe(4);
      expect(description).toBe('Approved gym member records');
    });
  });

  describe('SEO Tags Isolation (Marketing Homepage Only)', () => {
    it('marketing homepage contains full OpenGraph metadata', () => {
      expect(homeMetadata.openGraph).toBeDefined();
      const og = homeMetadata.openGraph as Record<string, unknown>;
      expect(og?.type).toBe('website');
      expect(og?.siteName).toBe('Spotter');
      expect(og?.title).toBe('Spotter | Approved Gym Records');
      expect(og?.description).toBe('Approved gym member records');
      expect(og?.url).toBe('https://spottergym.app/');
    });

    it('marketing homepage contains Twitter card metadata', () => {
      expect(homeMetadata.twitter).toBeDefined();
      const tw = homeMetadata.twitter as Record<string, unknown>;
      expect(tw?.card).toBe('summary');
      expect(tw?.title).toBe('Spotter | Approved Gym Records');
      expect(tw?.description).toBe('Approved gym member records');
    });

    it('marketing homepage contains canonical URL and indexable robots', () => {
      expect(homeMetadata.alternates?.canonical).toBe('https://spottergym.app/');
      expect(homeMetadata.robots).toEqual({
        index: true,
        follow: true,
      });
      expect(homeMetadata.keywords).toContain('gym records');
    });

    it('member route explicitly isolates records from SEO with noindex, nofollow', () => {
      expect(memberMetadata.robots).toEqual({
        index: false,
        follow: false,
      });
      expect(memberMetadata.openGraph).toBeUndefined();
      expect(memberMetadata.twitter).toBeUndefined();
    });
  });

  describe('Favicon (Blue rectangle with letter S)', () => {
    it('root metadata configures favicon icons', () => {
      expect(rootMetadata.icons).toBeDefined();
      const icons = rootMetadata.icons as Record<string, unknown>;
      expect(icons.icon).toBe('/favicon.svg');
    });

    it('public/favicon.svg exists and contains blue rectangle with letter S', () => {
      const faviconPath = path.resolve(__dirname, '../../public/favicon.svg');
      expect(fs.existsSync(faviconPath)).toBe(true);
      const faviconSvg = fs.readFileSync(faviconPath, 'utf8');
      expect(faviconSvg).toContain('<rect');
      expect(faviconSvg).toContain('fill="#0044e3"');
      expect(faviconSvg).toContain('>S</text>');
    });

    it('manifest.json references favicon', () => {
      const manifestPath = path.resolve(__dirname, '../../public/manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(manifest.icons.length).toBeGreaterThan(0);
      expect(manifest.icons[0].src).toBe('/favicon.svg');
    });
  });
});
