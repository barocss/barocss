import { CardVariantProps, CardInstance, CardSize, HEADER_SIZES, MEDIA_SIZES, CONTENT_SIZES, FOOTER_SIZES } from '@/types/card';
import { variables } from '@/variables';
import { CardHeaderManager } from './sections/CardHeaderManager';
import { CardMediaManager } from './sections/CardMediaManager';
import { CardContentManager } from './sections/CardContentManager';
import { CardFooterManager } from './sections/CardFooterManager';

// 카드 크기별 설정
const CARD_SIZES: Record<CardSize, {
  width: number;
  padding: string;
  spacing: string;
  borderRadius: string;
}> = {
  small: {
    width: 280,
    padding: 'component/base/padding/sm',
    spacing: 'component/base/gap/sm',
    borderRadius: 'component/base/radius/sm'
  },
  medium: {
    width: 320,
    padding: 'component/base/padding/md',
    spacing: 'component/base/gap/md',
    borderRadius: 'component/base/radius/md'
  },
  large: {
    width: 400,
    padding: 'component/base/padding/lg',
    spacing: 'component/base/gap/lg',
    borderRadius: 'component/base/radius/lg'
  }
};

export class CardCreator {
  private static instance: CardCreator;
  private componentSet: ComponentSetNode | null = null;
  private variantMap = new Map<string, ComponentNode>();

  // 섹션 매니저 인스턴스
  private headerManager = CardHeaderManager.getInstance();
  private mediaManager = CardMediaManager.getInstance();
  private contentManager = CardContentManager.getInstance();
  private footerManager = CardFooterManager.getInstance();

  private constructor() {}

  static getInstance() {
    if (!this.instance) {
      this.instance = new CardCreator();
    }
    return this.instance;
  }

  private getVariantKey(variant: CardVariantProps): string {
    const sections = [
      variant.header && 'header',
      variant.media && 'media',
      'content',
      variant.footer && 'footer'
    ].filter(Boolean);

    return [
      'size=' + (variant.size || 'medium'),
      'variant=' + (variant.variant || 'filled'),
      'status=' + (variant.status || 'default'),
      'interactive=' + (variant.interactive || false),
      'loading=' + (variant.loading || false),
      'sections=' + sections.join('+')
    ].join(',');
  }

  private setupBaseLayout(node: FrameNode | ComponentNode, size: typeof CARD_SIZES[keyof typeof CARD_SIZES]) {
    // 기본 레이아웃 설정
    node.layoutMode = "VERTICAL";
    node.primaryAxisAlignItems = "MIN";
    node.counterAxisAlignItems = "MIN";
    node.layoutSizingHorizontal = "FIXED";
    node.layoutSizingVertical = "HUG";
    node.resize(size.width, 0); // 높이는 자동 계산

    // 스타일 변수 설정
    variables.setBindVariable(node, 'itemSpacing', size.spacing);
    variables.setBindVariable(node, 'paddingLeft', size.padding);
    variables.setBindVariable(node, 'paddingRight', size.padding);
    variables.setBindVariable(node, 'paddingTop', size.padding);
    variables.setBindVariable(node, 'paddingBottom', size.padding);
    variables.setBindVariable(node, 'topLeftRadius', size.borderRadius);
    variables.setBindVariable(node, 'topRightRadius', size.borderRadius);
    variables.setBindVariable(node, 'bottomLeftRadius', size.borderRadius);
    variables.setBindVariable(node, 'bottomRightRadius', size.borderRadius);
  }

  private async createSectionsContainer(size: typeof CARD_SIZES[keyof typeof CARD_SIZES]) {
    const container = figma.createFrame();
    container.name = "Sections";
    container.layoutMode = "VERTICAL";
    variables.setBindVariable(container, 'itemSpacing', size.spacing);
    container.fills = [];
    container.layoutSizingHorizontal = "FILL";
    container.layoutSizingVertical = "HUG";
    return container;
  }

  private async createLoadingOverlay(width: number, height: number) {
    const overlay = figma.createFrame();
    overlay.name = "Loading Overlay";
    overlay.resize(width, height);
    overlay.fills = [{ 
      type: 'SOLID', 
      color: { r: 1, g: 1, b: 1 },
      opacity: 0.7 
    }];
    overlay.layoutMode = "HORIZONTAL";
    overlay.primaryAxisAlignItems = "CENTER";
    overlay.counterAxisAlignItems = "CENTER";
    
    const indicator = figma.createFrame();
    indicator.name = "Loading Indicator";
    indicator.resize(32, 32);
    indicator.cornerRadius = 16;
    indicator.fills = [variables.bindVariable('surface/color/secondary')];
    
    overlay.appendChild(indicator);
    return overlay;
  }

  async createComponent(variant: CardVariantProps): Promise<ComponentNode> {
    console.log('🎯 CardManager.createComponent - Start', { variant });
    
    const card = figma.createComponent();
    const size = CARD_SIZES[variant.size || 'medium'];
    card.name = this.getVariantKey(variant);
    
    // 기본 레이아웃 설정
    this.setupBaseLayout(card, size);
    
    // 섹션 컨테이너 생성
    const sectionsContainer = await this.createSectionsContainer(size);
    
    // 섹션 추가
    if (variant.header) {
      console.log('👤 Creating header:', variant.header);
      const headerInstance = await this.headerManager.createInstance({
        size: variant.size,
        variant: variant.variant,
        ...variant.header
      });
      if (headerInstance) {
        headerInstance.layoutSizingHorizontal = "FILL";
        sectionsContainer.appendChild(headerInstance);
      }
    }
    
    if (variant.media) {
      console.log('🖼️ Creating media:', variant.media);
      const mediaInstance = await this.mediaManager.createInstance({
        size: variant.size,
        variant: variant.variant,
        aspectRatio: variant.media.aspectRatio || '16/9',
        withOverlay: variant.interactive
      });
      if (mediaInstance) {
        mediaInstance.layoutSizingHorizontal = "FILL";
        sectionsContainer.appendChild(mediaInstance);
      }
    }
    
    // 컨텐츠는 항상 추가
    console.log('📝 Creating content:', variant.content);
    const contentInstance = await this.contentManager.createInstance({
      size: variant.size,
      variant: variant.variant,
      withTitle: variant.content?.withTitle,
      withDescription: variant.content?.withDescription
    });
    if (contentInstance) {
      contentInstance.layoutSizingHorizontal = "FILL";
      sectionsContainer.appendChild(contentInstance);
    }
    
    if (variant.footer) {
      console.log('👣 Creating footer:', variant.footer);
      const footerInstance = await this.footerManager.createInstance({
        size: variant.size,
        variant: variant.variant,
        withActions: variant.footer.withActions,
        alignment: variant.footer.alignment
      });
      if (footerInstance) {
        footerInstance.layoutSizingHorizontal = "FILL";
        sectionsContainer.appendChild(footerInstance);
      }
    }

    card.appendChild(sectionsContainer);
    
    // 스타일 적용
    await this.applyStyle(card, variant);
    
    return card;
  }

  private async applyStyle(card: ComponentNode, variant: CardVariantProps) {
    const state = variant.status || 'default';
    
    // 배경색 설정
    card.fills = [variables.bindVariable(`surface/color/${state}`)];
    
    // 테두리 설정
    if (variant.variant === 'outlined') {
      card.strokes = [variables.bindVariable(`surface/color/border`)];
      variables.setBindVariable(card, 'strokeWeight', 'border/width/default');
      card.strokeAlign = 'INSIDE';
    }
    
    // 그림자 설정
    if (variant.variant === 'elevated') {
      const shadow: Effect = {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.1 },
        offset: { x: 0, y: 2 },
        radius: 4,
        spread: 0,
        visible: true,
        blendMode: 'NORMAL'
      };
      card.effects = [shadow];
    }
    
    // 상호작용 상태 설정
    if (variant.interactive) {
      card.setRelaunchData({ 
        click: 'Click to interact',
        hover: 'Hover to preview'
      });
    }

    // 로딩 상태 설정
    if (variant.loading) {
      const overlay = await this.createLoadingOverlay(card.width, card.height);
      card.appendChild(overlay);
    }
  }

  private async createVariantComponents(): Promise<ComponentNode[]> {
    const variants: CardVariantProps[] = [
      // 기본 레이아웃 변형
      { size: 'medium', variant: 'filled' },
      { size: 'medium', variant: 'filled', header: {} },
      { size: 'medium', variant: 'filled', media: { aspectRatio: '16/9' } },
      { size: 'medium', variant: 'filled', footer: { withActions: true } },
      { size: 'medium', variant: 'filled', header: {}, media: { aspectRatio: '16/9' } },
      { size: 'medium', variant: 'filled', media: { aspectRatio: '16/9' }, footer: { withActions: true } },
      { size: 'medium', variant: 'filled', header: {}, footer: { withActions: true } },
      { 
        size: 'medium', 
        variant: 'filled', 
        header: {}, 
        media: { aspectRatio: '16/9' }, 
        footer: { withActions: true } 
      },
      
      // 크기 변형
      { 
        size: 'small', 
        variant: 'filled', 
        header: {}, 
        media: { aspectRatio: '16/9' }, 
        footer: { withActions: true } 
      },
      { 
        size: 'large', 
        variant: 'filled', 
        header: {}, 
        media: { aspectRatio: '16/9' }, 
        footer: { withActions: true } 
      },
      
      // 스타일 변형
      { 
        size: 'medium', 
        variant: 'outlined', 
        header: {}, 
        media: { aspectRatio: '16/9' }, 
        footer: { withActions: true } 
      },
      { 
        size: 'medium', 
        variant: 'elevated', 
        header: {}, 
        media: { aspectRatio: '16/9' }, 
        footer: { withActions: true } 
      },
      
      // 상태 변형
      { size: 'medium', variant: 'filled', status: 'error' },
      { size: 'medium', variant: 'filled', loading: true },
      { size: 'medium', variant: 'filled', interactive: true },
      
      // 특수 조합
      { 
        size: 'medium', 
        variant: 'elevated', 
        interactive: true,
        header: { withAvatar: true },
        media: { aspectRatio: '16/9' },
        footer: { withActions: true }
      },
      { 
        size: 'large', 
        variant: 'outlined', 
        status: 'error',
        header: { withExtra: true },
        content: { withTitle: true, withDescription: true },
        footer: { withActions: true, alignment: 'right' }
      }
    ];

    return Promise.all(variants.map(variant => this.createComponent(variant)));
  }

  async getComponentSet(): Promise<ComponentSetNode> {
    if (this.componentSet) return this.componentSet;

    const components = await this.createVariantComponents();
    this.componentSet = figma.combineAsVariants(components, figma.currentPage);
    this.setupComponentSetLayout(this.componentSet);

    components.forEach(component => {
      this.variantMap.set(component.name, component);
    });

    return this.componentSet;
  }

  private setupComponentSetLayout(componentSet: ComponentSetNode) {
    componentSet.name = "Card";
    componentSet.layoutMode = "HORIZONTAL";
    componentSet.layoutWrap = "WRAP";
    componentSet.itemSpacing = 40;
    componentSet.counterAxisSpacing = 40;
    componentSet.paddingLeft = componentSet.paddingRight = 40;
    componentSet.paddingTop = componentSet.paddingBottom = 40;
    componentSet.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    componentSet.resize(1800, componentSet.height);
    componentSet.primaryAxisSizingMode = "FIXED";
    componentSet.counterAxisSizingMode = "AUTO";

    // 컴포넌트 세트 설명 추가
    componentSet.description = `
Card Component
-------------
A versatile container for displaying content and actions.

Sections:
- Header (optional): Title, subtitle, avatar, or actions
- Media (optional): Images or videos with optional overlay
- Content (required): Main content area
- Footer (optional): Actions and additional information

Variants:
- Size: small, medium, large
- Style: filled, outlined, elevated
- Status: default, error
- States: interactive, loading

Usage:
- Use cards to group related information
- Combine different sections based on content needs
- Consider interactive state for clickable cards
- Use proper hierarchy with title and content
    `.trim();
  }

  async createInstance(variant: CardVariantProps, props: CardInstance = {}) {
    const componentSet = await this.getComponentSet();
    if (!componentSet) return null;

    // 적절한 변형 찾기
    const variantKey = this.getVariantKey(variant);
    const targetVariant = this.variantMap.get(variantKey) || componentSet.defaultVariant;
    
    if (!targetVariant) return null;

    const instance = targetVariant.createInstance();
    
    // 인스턴스 업데이트
    await this.updateInstance(instance, props);
    
    return instance;
  }

  async updateInstance(instance: InstanceNode, props: CardInstance = {}) {
    const sectionsContainer = instance.findOne(node => node.name === "Sections") as FrameNode;
    if (!sectionsContainer) return;

    // 헤더 업데이트
    if (props.header) {
      const header = sectionsContainer.findOne(node => 
        node.type === "INSTANCE" && node.name.includes("Card Header")
      ) as InstanceNode;
      if (header) {
        await this.headerManager.updateInstance(header, props.header);
      }
    }
    
    // 미디어 업데이트
    if (props.media) {
      const media = sectionsContainer.findOne(node => 
        node.type === "INSTANCE" && node.name.includes("Card Media")
      ) as InstanceNode;
      if (media) {
        await this.mediaManager.updateInstance(media, props.media);
      }
    }
    
    // 컨텐츠 업데이트
    if (props.content) {
      const content = sectionsContainer.findOne(node => 
        node.type === "INSTANCE" && node.name.includes("Card Content")
      ) as InstanceNode;
      if (content) {
        await this.contentManager.updateInstance(content, props.content);
      }
    }
    
    // 푸터 업데이트
    if (props.footer) {
      const footer = sectionsContainer.findOne(node => 
        node.type === "INSTANCE" && node.name.includes("Card Footer")
      ) as InstanceNode;
      if (footer) {
        await this.footerManager.updateInstance(footer, props.footer);
      }
    }
  }
} 