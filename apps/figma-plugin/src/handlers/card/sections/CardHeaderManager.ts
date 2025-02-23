import { CardHeaderProps, CardHeaderVariantProps, HEADER_SIZES, HEADER_VARIANTS } from '@/types/card';
import { variables } from '@/variables';
import { createHandlers } from '../../createBase';

export class CardHeaderManager {
  private static instance: CardHeaderManager;
  private componentSet: ComponentSetNode | null = null;
  private variantMap = new Map<string, ComponentNode>();

  private constructor() {}

  static getInstance() {
    if (!this.instance) {
      this.instance = new CardHeaderManager();
    }
    return this.instance;
  }

  private getVariantKey(variant: CardHeaderVariantProps): string {
    return [
      'size=' + (variant.size || 'medium'),
      'variant=' + (variant.variant || 'filled'),
      'withAvatar=' + (variant.withAvatar || false),
      'withExtra=' + (variant.withExtra || false),
      'withSubtitle=' + (variant.withSubtitle || false)
    ].join(',');
  }

  private setupBaseLayout(node: FrameNode | ComponentNode, size?: typeof HEADER_SIZES[keyof typeof HEADER_SIZES], isChild: boolean = false) {
    node.layoutMode = "HORIZONTAL";
    node.primaryAxisAlignItems = "SPACE_BETWEEN";
    node.counterAxisAlignItems = "CENTER";
    node.counterAxisSizingMode = "AUTO";

    if (size) {
      variables.setBindVariable(node, 'height', size.height);
      variables.setBindVariable(node, 'paddingLeft', size.padding);
      variables.setBindVariable(node, 'paddingRight', size.padding);
      variables.setBindVariable(node, 'paddingTop', size.padding);
      variables.setBindVariable(node, 'paddingBottom', size.padding);
    }
  }

  private async createAvatar(size: typeof HEADER_SIZES[keyof typeof HEADER_SIZES]) {
    const avatar = figma.createFrame();
    avatar.name = "Avatar";
    variables.setBindVariable(avatar, 'width', size.height);
    variables.setBindVariable(avatar, 'height', size.height);
    variables.setBindVariable(avatar, 'topLeftRadius', 'component/base/radius/full');
    variables.setBindVariable(avatar, 'topRightRadius', 'component/base/radius/full');
    variables.setBindVariable(avatar, 'bottomLeftRadius', 'component/base/radius/full');
    variables.setBindVariable(avatar, 'bottomRightRadius', 'component/base/radius/full');
    avatar.fills = [variables.bindVariable('surface/color/default')];
    avatar.strokeWeight = 1;
    avatar.strokes = [variables.bindVariable('surface/color/border')];
    return avatar;
  }

  private async createTextContainer(size: typeof HEADER_SIZES[keyof typeof HEADER_SIZES], variant: CardHeaderVariantProps) {
    const textContainer = figma.createFrame();
    textContainer.name = "Text Container";
    textContainer.layoutMode = "VERTICAL";
    variables.setBindVariable(textContainer, 'itemSpacing', 'component/base/gap/xs');
    textContainer.fills = [];

    // 제목 (필수)
    const title = await createHandlers.text({
      text: "Title",
      name: "Title",
      fills: [variables.bindVariable(`text/color/default`)]
    });
    variables.setBindVariable(title, 'fontSize', size.fontSize.title);
    textContainer.appendChild(title);

    // 부제목 (옵션)
    if (variant.withSubtitle) {
      const subtitle = await createHandlers.text({
        text: "Subtitle",
        name: "Subtitle",
        fills: [variables.bindVariable(`text/color/secondary`)]
      });
      variables.setBindVariable(subtitle, 'fontSize', size.fontSize.subtitle);
      textContainer.appendChild(subtitle);
    }

    return textContainer;
  }

  private async createExtra(size: typeof HEADER_SIZES[keyof typeof HEADER_SIZES]) {
    const extra = await createHandlers.text({
      text: "Extra",
      name: "Extra",
      fills: [variables.bindVariable(`text/color/secondary`)]
    });
    variables.setBindVariable(extra, 'fontSize', size.fontSize.subtitle);
    return extra;
  }

  async createComponent(variant: CardHeaderVariantProps): Promise<ComponentNode> {
    console.log('👤 CardHeaderManager.createComponent:', { variant });
    const header = figma.createComponent();
    const size = HEADER_SIZES[variant.size || 'medium'];
    header.name = this.getVariantKey(variant);
    
    // 기본 레이아웃 설정
    this.setupBaseLayout(header, size);
    
    // 왼쪽 컨테이너 (아바타 + 텍스트)
    const leftContainer = figma.createFrame();
    leftContainer.name = "Left Container";
    leftContainer.layoutMode = "HORIZONTAL";
    variables.setBindVariable(leftContainer, 'itemSpacing', size.spacing);
    leftContainer.counterAxisAlignItems = "CENTER";
    leftContainer.fills = [];
    this.setupBaseLayout(leftContainer);
    header.appendChild(leftContainer);        
    leftContainer.layoutSizingHorizontal = "FILL";
    leftContainer.layoutSizingVertical = "HUG";
    
    // 아바타 (옵션)
    if (variant.withAvatar) {
      const avatar = await this.createAvatar(size);
      leftContainer.appendChild(avatar);
    }
    
    // 텍스트 컨테이너
    const textContainer = await this.createTextContainer(size, variant);
    leftContainer.appendChild(textContainer);
    textContainer.layoutSizingHorizontal = "FILL";
    textContainer.layoutSizingVertical = "HUG";
    
    // 추가 액션 (옵션)
    if (variant.withExtra) {
      const extra = await this.createExtra(size);
      header.appendChild(extra);
    }
    
    // 스타일 적용
    await this.applyStyle(header);
    
    return header;
  }

  private async applyStyle(header: ComponentNode) {
    // 배경색 설정
    header.fills = [variables.bindVariable(`surface/color/default`)];
  }

  private async createVariantComponents(): Promise<ComponentNode[]> {
    return Promise.all(HEADER_VARIANTS.map(variant => this.createComponent(variant)));
  }

  async getComponentSet(): Promise<ComponentSetNode> {
    if (this.componentSet) return this.componentSet;

    const components = await this.createVariantComponents();
    this.componentSet = figma.combineAsVariants(components, figma.currentPage);
    this.setupComponentSetLayout(this.componentSet);

    components.forEach(component => {
      this.variantMap.set(component.name, component);

      component.layoutSizingHorizontal = "FILL";
      component.layoutSizingVertical = "HUG";
    });

    return this.componentSet;
  }

  private setupComponentSetLayout(componentSet: ComponentSetNode) {
    componentSet.name = "Card Header";
    componentSet.layoutMode = "VERTICAL";
    componentSet.itemSpacing = 40;
    componentSet.counterAxisSpacing = 40;
    componentSet.paddingLeft = componentSet.paddingRight = 40;
    componentSet.paddingTop = componentSet.paddingBottom = 40;
    componentSet.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    componentSet.resize(400, componentSet.height);
    componentSet.primaryAxisSizingMode = "AUTO";
    componentSet.counterAxisSizingMode = "FIXED";
  }

  private getVariantFromProps(props: CardHeaderProps): CardHeaderVariantProps {
    return {
      size: 'medium',
      variant: 'filled',
      withAvatar: !!props.avatar,
      withExtra: !!props.extra,
      withSubtitle: !!props.subtitle
    };
  }

  async createInstance(props: CardHeaderProps = {}) {
    console.log('👤 CardHeaderManager.createInstance:', { props });
    const componentSet = await this.getComponentSet();
    if (!componentSet) return null;

    const variant = this.getVariantFromProps(props);
    const variantKey = this.getVariantKey(variant);
    const targetVariant = this.variantMap.get(variantKey) || componentSet.defaultVariant;
    
    if (!targetVariant) return null;

    const instance = targetVariant.createInstance();
    await this.updateInstance(instance, props);
    
    return instance;
  }

  async updateInstance(instance: InstanceNode, props: CardHeaderProps = {}) {
    const updateText = (name: string, value?: string) => {
      if (!value) return;
      const node = instance.findOne(node => node.name === name) as TextNode;
      if (node) node.characters = value;
    };

    updateText("Title", props.title);
    updateText("Subtitle", props.subtitle);
    updateText("Extra", props.extra);
  }
} 