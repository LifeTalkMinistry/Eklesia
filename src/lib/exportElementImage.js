const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const MAX_CANVAS_PIXELS = 28_000_000;

function copyComputedStyles(source, clone) {
  if (!(source instanceof Element) || !(clone instanceof Element)) return;

  const computed = window.getComputedStyle(source);
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    clone.style.setProperty(
      property,
      computed.getPropertyValue(property),
      computed.getPropertyPriority(property),
    );
  }

  clone.style.setProperty('animation', 'none');
  clone.style.setProperty('transition', 'none');
  clone.style.setProperty('caret-color', 'transparent');

  if (source instanceof HTMLTextAreaElement) clone.textContent = source.value;
  if (source instanceof HTMLInputElement) clone.setAttribute('value', source.value);

  const sourceChildren = Array.from(source.children);
  const cloneChildren = Array.from(clone.children);
  sourceChildren.forEach((child, index) => copyComputedStyles(child, cloneChildren[index]));
}

function prepareExportClone(element, width) {
  const clone = element.cloneNode(true);
  copyComputedStyles(element, clone);

  clone.querySelectorAll('[data-image-export-exclude]').forEach((node) => node.remove());
  clone.querySelectorAll('[data-image-export-only]').forEach((node) => {
    node.style.setProperty('display', node.dataset.imageExportDisplay || 'block');
  });

  clone.setAttribute('xmlns', XHTML_NAMESPACE);
  clone.style.setProperty('width', `${width}px`);
  clone.style.setProperty('min-width', `${width}px`);
  clone.style.setProperty('max-width', 'none');
  clone.style.setProperty('height', 'auto');
  clone.style.setProperty('margin', '0');
  clone.style.setProperty('transform', 'none');

  return clone;
}

function loadSvgImage(svgBlob) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('The devotion image could not be rendered.'));
    };
    image.src = objectUrl;
  });
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The devotion image could not be created.'));
    }, 'image/png');
  });
}

export async function renderElementAsPng(element, options = {}) {
  if (!(element instanceof HTMLElement)) {
    throw new Error('The devotion image area is unavailable.');
  }

  await document.fonts?.ready;

  const backgroundColor = options.backgroundColor || '#0b1711';
  const padding = Number.isFinite(options.padding) ? Math.max(0, options.padding) : 24;
  const sourceWidth = Math.ceil(Math.max(element.getBoundingClientRect().width, element.scrollWidth));
  if (!sourceWidth) throw new Error('The devotion image area has no visible width.');

  const measureHost = document.createElement('div');
  measureHost.style.position = 'fixed';
  measureHost.style.left = '-100000px';
  measureHost.style.top = '0';
  measureHost.style.zIndex = '-1';
  measureHost.style.boxSizing = 'border-box';
  measureHost.style.width = `${sourceWidth + (padding * 2)}px`;
  measureHost.style.padding = `${padding}px`;
  measureHost.style.overflow = 'hidden';
  measureHost.style.color = '#fffdf5';
  measureHost.style.background = backgroundColor;
  measureHost.style.pointerEvents = 'none';

  const clone = prepareExportClone(element, sourceWidth);
  measureHost.appendChild(clone);
  document.body.appendChild(measureHost);

  try {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    const width = Math.ceil(measureHost.scrollWidth);
    const height = Math.ceil(measureHost.scrollHeight);
    if (!width || !height) throw new Error('The devotion image area could not be measured.');

    const exportNode = measureHost.cloneNode(true);
    exportNode.setAttribute('xmlns', XHTML_NAMESPACE);
    exportNode.style.position = 'static';
    exportNode.style.left = 'auto';
    exportNode.style.top = 'auto';
    exportNode.style.zIndex = 'auto';
    exportNode.style.width = `${width}px`;
    exportNode.style.height = `${height}px`;

    const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
    svg.setAttribute('xmlns', SVG_NAMESPACE);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const foreignObject = document.createElementNS(SVG_NAMESPACE, 'foreignObject');
    foreignObject.setAttribute('x', '0');
    foreignObject.setAttribute('y', '0');
    foreignObject.setAttribute('width', '100%');
    foreignObject.setAttribute('height', '100%');
    foreignObject.appendChild(exportNode);
    svg.appendChild(foreignObject);

    const serializedSvg = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const { image, objectUrl } = await loadSvgImage(svgBlob);

    try {
      const desiredScale = Math.max(2, 1080 / width);
      const safeScale = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
      const scale = Math.max(0.75, Math.min(4, desiredScale, safeScale));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));

      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not prepare the devotion image.');

      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.drawImage(image, 0, 0, width, height);
      return await canvasToPngBlob(canvas);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } finally {
    measureHost.remove();
  }
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function browserCanShareFile(file) {
  if (!file || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return false;
  }

  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function shareOrDownloadElementImage(element, options = {}) {
  const filename = options.filename || 'ekklesia-pulse-devotion.png';
  const blob = await renderElementAsPng(element, options);
  const file = typeof File === 'function'
    ? new File([blob], filename, { type: 'image/png' })
    : null;

  if (browserCanShareFile(file)) {
    try {
      await navigator.share({
        files: [file],
        title: options.title || 'My Ekklesia Pulse devotion',
        text: options.text || 'A reflection from my time in the Word.',
      });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      console.warn('Native sharing was unavailable; downloading the devotion image instead.', error);
    }
  }

  downloadBlob(blob, filename);
  return 'downloaded';
}
