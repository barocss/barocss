import { describe, it, expect } from 'vitest';
import { jsonToAst, generateCssFromJson, BaroJsonInput } from '../src/core/jsonToAst';
import { createContext } from '../src/core/context';
import '../src/presets'; // Register presets

describe('jsonToAst', () => {
    const ctx = createContext({
        theme: {
            colors: { red: { 500: '#ef4444' }, blue: { 500: '#3b82f6' } },
            spacing: { 4: '1rem' }
        }
    });

    it('basic utility', () => {
        const input: BaroJsonInput = {
            utility: { name: 'bg', value: 'red-500' }
        };
        const css = generateCssFromJson([input], ctx);
        expect(css).toContain('background-color: #ef4444');
        expect(css).toContain('.bg-red-500');
    });

    it('utility with variants', () => {
        const input: BaroJsonInput = {
            utility: { name: 'bg', value: 'blue-500' },
            variants: ['hover', 'focus']
        };
        const css = generateCssFromJson([input], ctx);
        // hover:focus:bg-blue-500
        // Should be wrapped in hover and focus
        expect(css).toContain('background-color: #3b82f6');
        expect(css).toContain(':hover');
        expect(css).toContain(':focus');
    });

    it('arbitrary value', () => {
        const input: BaroJsonInput = {
            utility: { name: 'bg', value: '#123456', arbitrary: true }
        };
        const css = generateCssFromJson([input], ctx);
        expect(css).toContain('background-color: #123456');
    });

    it('negative value', () => {
        const input: BaroJsonInput = {
            utility: { name: 'm', value: '4', negative: true }
        };
        const css = generateCssFromJson([input], ctx);
        expect(css).toContain('margin: calc(var(--spacing) * -4)');
    });

    it('important modifier', () => {
        const input: BaroJsonInput = {
            utility: { name: 'text', value: 'center', important: true }
        };
        const css = generateCssFromJson([input], ctx);
        expect(css).toContain('text-align: center !important');
    });

    it('complex example', () => {
        // sm:hover:bg-red-500
        const input: BaroJsonInput = {
            utility: { name: 'bg', value: 'red-500' },
            variants: ['sm', 'hover']
        };
        const css = generateCssFromJson([input], ctx);
        expect(css).toContain('@media (min-width: 40rem)');
        expect(css).toContain(':hover');
        expect(css).toContain('background-color: #ef4444');
    });

    it('multiple inputs', () => {
        const inputs: BaroJsonInput[] = [
            { utility: { name: 'bg', value: 'red-500' } },
            { utility: { name: 'text', value: 'white' } }
        ];
        const css = generateCssFromJson(inputs, ctx);
        expect(css).toContain('background-color: #ef4444');
        expect(css).toContain('color: #fff');
    });
    it('opacity modifier', () => {
        const input: BaroJsonInput = {
            utility: { name: 'bg', value: 'red-500', opacity: '50' }
        };
        const css = generateCssFromJson([input], ctx);
        // Expect color-mix or rgba with opacity
        // The exact output depends on how the color utility handles opacity, usually color-mix for modern CSS or rgba
        expect(css).toContain('color-mix(in lab, #ef4444 50%, transparent)');
    });

    it('arbitrary variant', () => {
        // min-[320px]:block
        const input: BaroJsonInput = {
            utility: { name: 'block' },
            variants: [{ name: 'min', value: '320px', arbitrary: true }]
        };
        const css = generateCssFromJson([input], ctx);
        expect(css).toContain('@media (width >= 320px)');
        expect(css).toContain('display: block');
    });

    it('parameterized variant', () => {
        // data-[state=open]:block
        const input: BaroJsonInput = {
            utility: { name: 'block' },
            variants: [{ name: 'data', value: 'state=open' }]
        };
        const css = generateCssFromJson([input], ctx);
        expect(css).toContain('[data-state="open"]');
        expect(css).toContain('display: block');
    });

    it('custom property value', () => {
        // w-(--my-width)
        const input: BaroJsonInput = {
            utility: { name: 'w', value: '--my-width', customProperty: true }
        };
        const css = generateCssFromJson([input], ctx);
        expect(css).toContain('width: var(--my-width)');
    });

    it('complex arbitrary value', () => {
        // w-[calc(100%-20px)]
        const input: BaroJsonInput = {
            utility: { name: 'w', value: 'calc(100%-20px)', arbitrary: true }
        };
        const css = generateCssFromJson([input], ctx);
        expect(css).toContain('width: calc(100%-20px)');
    });
    it('group hover', () => {
        // group-hover:text-white
        const input: BaroJsonInput = {
            utility: { name: 'text', value: 'white' },
            variants: ['group-hover']
        };
        const css = generateCssFromJson([input], ctx);
        // Should generate .group:hover .group-hover\:text-white
        expect(css).toContain(':where(.group):hover');
        expect(css).toContain('color: #fff');
    });
});
