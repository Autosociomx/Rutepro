export interface CreativeBrief {
  businessName: string;
  productName: string;
  headline: string;
  subheadline?: string;
  priceLabel?: string;
  callToAction?: string;
  brandColor?: string;
  format: 'square' | 'story';
}

export interface GeneratedCreative {
  source: 'ai' | 'template';
  mimeType: string;
  uri: string;
  width: number;
  height: number;
  requiresHumanApproval: true;
}

export interface CreativeProvider {
  readonly name: string;
  generate(brief: CreativeBrief): Promise<GeneratedCreative>;
}

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

export class TemplateCreativeProvider implements CreativeProvider {
  readonly name = 'template-svg';

  async generate(brief: CreativeBrief): Promise<GeneratedCreative> {
    const width = 1080;
    const height = brief.format === 'story' ? 1920 : 1080;
    const color = /^#[0-9a-f]{6}$/i.test(brief.brandColor || '') ? brief.brandColor : '#E5B84B';
    const headline = escapeXml(brief.headline.slice(0, 54));
    const subheadline = escapeXml((brief.subheadline || brief.productName).slice(0, 80));
    const businessName = escapeXml(brief.businessName.slice(0, 44));
    const price = escapeXml((brief.priceLabel || '').slice(0, 24));
    const cta = escapeXml((brief.callToAction || 'Pide directo').slice(0, 28));
    const heroY = brief.format === 'story' ? 780 : 480;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#11151c"/>
      <circle cx="${width - 120}" cy="120" r="260" fill="${color}" opacity="0.16"/>
      <circle cx="80" cy="${height - 80}" r="320" fill="${color}" opacity="0.08"/>
      <text x="72" y="100" fill="#ffffff" font-family="system-ui, sans-serif" font-size="34" font-weight="700">${businessName}</text>
      <text x="72" y="${heroY}" fill="#ffffff" font-family="system-ui, sans-serif" font-size="82" font-weight="800">${headline}</text>
      <text x="72" y="${heroY + 100}" fill="#aab1bd" font-family="system-ui, sans-serif" font-size="34">${subheadline}</text>
      ${price ? `<text x="72" y="${heroY + 190}" fill="${color}" font-family="system-ui, sans-serif" font-size="54" font-weight="800">${price}</text>` : ''}
      <rect x="72" y="${height - 190}" rx="28" ry="28" width="360" height="92" fill="${color}"/>
      <text x="252" y="${height - 132}" text-anchor="middle" fill="#11151c" font-family="system-ui, sans-serif" font-size="30" font-weight="800">${cta}</text>
      <text x="72" y="${height - 48}" fill="#657080" font-family="system-ui, sans-serif" font-size="24">Generado por ConnectX Growth · requiere aprobación</text>
    </svg>`;

    return {
      source: 'template',
      mimeType: 'image/svg+xml',
      uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      width,
      height,
      requiresHumanApproval: true,
    };
  }
}

export class HttpCreativeProvider implements CreativeProvider {
  readonly name = 'http-ai-creative';

  constructor(private readonly endpoint = '/api/creative/generate') {}

  async generate(brief: CreativeBrief): Promise<GeneratedCreative> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief }),
    });
    if (!response.ok) throw new Error(`Creative AI unavailable: ${response.status}`);
    const body = await response.json() as Partial<GeneratedCreative>;
    if (!body.uri || !body.mimeType || !body.width || !body.height) throw new Error('Invalid creative AI response');
    return {
      source: 'ai',
      mimeType: body.mimeType,
      uri: body.uri,
      width: body.width,
      height: body.height,
      requiresHumanApproval: true,
    };
  }
}

export class HybridCreativeProvider implements CreativeProvider {
  readonly name = 'hybrid-creative';

  constructor(
    private readonly fallback: CreativeProvider = new TemplateCreativeProvider(),
    private readonly ai?: CreativeProvider,
  ) {}

  async generate(brief: CreativeBrief): Promise<GeneratedCreative> {
    if (this.ai) {
      try {
        return await this.ai.generate(brief);
      } catch {
        // The business must keep producing content even if the AI provider is down.
      }
    }
    return this.fallback.generate(brief);
  }
}
