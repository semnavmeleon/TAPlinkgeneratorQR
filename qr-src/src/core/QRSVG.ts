import calculateImageSize from "../tools/calculateImageSize";
import toDataUrl from "../tools/toDataUrl";
import errorCorrectionPercents from "../constants/errorCorrectionPercents";
import QRDot from "../figures/dot/QRDot";
import QRCornerSquare, { availableCornerSquareTypes } from "../figures/cornerSquare/QRCornerSquare";
import QRCornerDot, { availableCornerDotTypes } from "../figures/cornerDot/QRCornerDot";
import { RequiredOptions } from "./QROptions";
import gradientTypes from "../constants/gradientTypes";
import shapeTypes from "../constants/shapeTypes";
import { DotType, QRCode, FilterFunction, Gradient, Window } from "../types";

// ─── finder-pattern masks (7×7) ───────────────────────────────────────────────
const squareMask = [
  [1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1],
  [1,0,0,0,0,0,1],
  [1,0,0,0,0,0,1],
  [1,0,0,0,0,0,1],
  [1,0,0,0,0,0,1],
  [1,1,1,1,1,1,1]
];

const dotMask = [
  [0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0],
  [0,0,1,1,1,0,0],
  [0,0,1,1,1,0,0],
  [0,0,1,1,1,0,0],
  [0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0]
];

// ─── alignment-pattern masks (5×5) ────────────────────────────────────────────
const alignmentSquareMask = [
  [1,1,1,1,1],
  [1,0,0,0,1],
  [1,0,0,0,1],
  [1,0,0,0,1],
  [1,1,1,1,1]
];

const alignmentDotMask = [
  [0,0,0,0,0],
  [0,0,0,0,0],
  [0,0,1,0,0],
  [0,0,0,0,0],
  [0,0,0,0,0]
];

// ─── QR-spec alignment-pattern center-position table ─────────────────────────
// Index = QR version (2–40). Values are the row/col positions of pattern centres.
const ALIGNMENT_PATTERN_TABLE: { [v: number]: number[] } = {
  2:[6,18], 3:[6,22], 4:[6,26], 5:[6,30], 6:[6,34],
  7:[6,22,38], 8:[6,24,42], 9:[6,26,46], 10:[6,28,50],
  11:[6,30,54], 12:[6,32,58], 13:[6,34,62],
  14:[6,26,46,66], 15:[6,26,48,70], 16:[6,26,50,74], 17:[6,30,54,78],
  18:[6,30,56,82], 19:[6,30,58,86], 20:[6,34,62,90],
  21:[6,28,50,72,94], 22:[6,26,50,74,98], 23:[6,30,54,78,102],
  24:[6,28,54,80,106], 25:[6,32,58,84,110], 26:[6,30,58,86,114],
  27:[6,34,62,90,118],
  28:[6,26,50,74,98,122], 29:[6,30,54,78,102,126], 30:[6,26,52,78,104,130],
  31:[6,30,56,82,108,134], 32:[6,34,60,86,112,138], 33:[6,30,58,86,114,142],
  34:[6,34,62,90,118,146],
  35:[6,30,54,78,102,126,150], 36:[6,24,50,76,102,128,154],
  37:[6,28,54,80,106,132,158], 38:[6,32,58,84,110,136,162],
  39:[6,26,54,82,110,138,166], 40:[6,30,58,86,114,142,170]
};

/** Returns {row,col} centres of all alignment patterns that don't overlap finder corners. */
function getAlignmentCenters(count: number): Array<{row: number; col: number}> {
  const version = (count - 17) / 4;
  if (version < 2 || !Number.isInteger(version)) return [];
  const positions = ALIGNMENT_PATTERN_TABLE[version];
  if (!positions) return [];

  const centers: Array<{row: number; col: number}> = [];
  for (let i = 0; i < positions.length; i++) {
    for (let j = 0; j < positions.length; j++) {
      const row = positions[i];
      const col = positions[j];
      // Skip cells that overlap any of the three finder patterns
      if (row <= 8 && col <= 8) continue;           // top-left
      if (row <= 8 && col >= count - 8) continue;   // top-right
      if (row >= count - 8 && col <= 8) continue;   // bottom-left
      centers.push({ row, col });
    }
  }
  return centers;
}

export default class QRSVG {
  _window: Window;
  _element: SVGElement;
  _defs: SVGElement;
  _backgroundClipPath?: SVGElement;
  _dotsClipPath?: SVGElement;
  _cornersSquareClipPath?: SVGElement;
  _cornersDotClipPath?: SVGElement;
  _options: RequiredOptions;
  _qr?: QRCode;
  _image?: HTMLImageElement;
  _imageUri?: string;
  _instanceId: number;

  static instanceCount = 0;

  constructor(options: RequiredOptions, window: Window) {
    this._window = window;
    this._element = this._window.document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this._element.setAttribute("width", String(options.width));
    this._element.setAttribute("height", String(options.height));
    this._element.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    if (!options.dotsOptions.roundSize) {
      this._element.setAttribute("shape-rendering", "crispEdges");
    }
    this._element.setAttribute("viewBox", `0 0 ${options.width} ${options.height}`);
    this._defs = this._window.document.createElementNS("http://www.w3.org/2000/svg", "defs");
    this._element.appendChild(this._defs);
    this._imageUri = options.image;
    this._instanceId = QRSVG.instanceCount++;
    this._options = options;
  }

  get width(): number { return this._options.width; }
  get height(): number { return this._options.height; }
  getElement(): SVGElement { return this._element; }

  async drawQR(qr: QRCode): Promise<void> {
    const count = qr.getModuleCount();
    const minSize = Math.min(this._options.width, this._options.height) - this._options.margin * 2;
    const realQRSize = this._options.shape === shapeTypes.circle ? minSize / Math.sqrt(2) : minSize;
    const dotSize = this._roundSize(realQRSize / count);
    let drawImageSize = { hideXDots:0, hideYDots:0, width:0, height:0 };

    this._qr = qr;

    if (this._options.image) {
      await this.loadImage();
      if (!this._image) return;
      const { imageOptions, qrOptions } = this._options;
      const coverLevel = imageOptions.imageSize * errorCorrectionPercents[qrOptions.errorCorrectionLevel];
      const maxHiddenDots = Math.floor(coverLevel * count * count);
      drawImageSize = calculateImageSize({
        originalWidth: this._image.width,
        originalHeight: this._image.height,
        maxHiddenDots,
        maxHiddenAxisDots: count - 14,
        dotSize
      });
    }

    // Pre-compute alignment centres so we can filter + draw them
    const alignmentCenters = getAlignmentCenters(count);

    this.drawBackground();
    this.drawDots((row: number, col: number): boolean => {
      if (this._options.imageOptions.hideBackgroundDots) {
        if (
          row >= (count - drawImageSize.hideYDots) / 2 &&
          row < (count + drawImageSize.hideYDots) / 2 &&
          col >= (count - drawImageSize.hideXDots) / 2 &&
          col < (count + drawImageSize.hideXDots) / 2
        ) return false;
      }

      // Exclude finder-pattern modules
      if (squareMask[row]?.[col] || squareMask[row - count + 7]?.[col] || squareMask[row]?.[col - count + 7]) return false;
      if (dotMask[row]?.[col]   || dotMask[row - count + 7]?.[col]    || dotMask[row]?.[col - count + 7])    return false;

      // Exclude alignment-pattern modules so we can re-draw them styled
      for (const c of alignmentCenters) {
        if (Math.abs(row - c.row) <= 2 && Math.abs(col - c.col) <= 2) return false;
      }

      return true;
    });

    this.drawCorners();
    this.drawAlignmentPatterns(alignmentCenters);

    if (this._options.image) {
      await this.drawImage({ width: drawImageSize.width, height: drawImageSize.height, count, dotSize });
    }
  }

  // ─── background ─────────────────────────────────────────────────────────────
  drawBackground(): void {
    const element = this._element;
    const options = this._options;
    if (element) {
      const gradientOptions = options.backgroundOptions?.gradient;
      const color = options.backgroundOptions?.color;
      let height = options.height;
      let width = options.width;
      if (gradientOptions || color) {
        const el = this._window.document.createElementNS("http://www.w3.org/2000/svg", "rect");
        this._backgroundClipPath = this._window.document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
        this._backgroundClipPath.setAttribute("id", `clip-path-background-color-${this._instanceId}`);
        this._defs.appendChild(this._backgroundClipPath);
        if (options.backgroundOptions?.round) {
          height = width = Math.min(options.width, options.height);
          el.setAttribute("rx", String((height / 2) * options.backgroundOptions.round));
        }
        el.setAttribute("x", String(this._roundSize((options.width - width) / 2)));
        el.setAttribute("y", String(this._roundSize((options.height - height) / 2)));
        el.setAttribute("width", String(width));
        el.setAttribute("height", String(height));
        this._backgroundClipPath.appendChild(el);
        this._createColor({ options: gradientOptions, color, additionalRotation:0, x:0, y:0, height: options.height, width: options.width, name: `background-color-${this._instanceId}` });
      }
    }
  }

  // ─── dots ───────────────────────────────────────────────────────────────────
  drawDots(filter?: FilterFunction): void {
    if (!this._qr) throw "QR code is not defined";
    const options = this._options;
    const count = this._qr.getModuleCount();
    if (count > options.width || count > options.height) throw "The canvas is too small.";

    const minSize = Math.min(options.width, options.height) - options.margin * 2;
    const realQRSize = options.shape === shapeTypes.circle ? minSize / Math.sqrt(2) : minSize;
    const dotSize = this._roundSize(realQRSize / count);
    const xBeginning = this._roundSize((options.width - count * dotSize) / 2);
    const yBeginning = this._roundSize((options.height - count * dotSize) / 2);
    const dot = new QRDot({ svg: this._element, type: options.dotsOptions.type, window: this._window });

    this._dotsClipPath = this._window.document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
    this._dotsClipPath.setAttribute("id", `clip-path-dot-color-${this._instanceId}`);
    this._defs.appendChild(this._dotsClipPath);

    this._createColor({ options: options.dotsOptions?.gradient, color: options.dotsOptions.color, additionalRotation:0, x:0, y:0, height: options.height, width: options.width, name: `dot-color-${this._instanceId}` });

    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (filter && !filter(row, col)) continue;
        if (!this._qr?.isDark(row, col)) continue;
        dot.draw(
          xBeginning + col * dotSize, yBeginning + row * dotSize, dotSize,
          (xOffset: number, yOffset: number): boolean => {
            if (col + xOffset < 0 || row + yOffset < 0 || col + xOffset >= count || row + yOffset >= count) return false;
            if (filter && !filter(row + yOffset, col + xOffset)) return false;
            return !!this._qr && this._qr.isDark(row + yOffset, col + xOffset);
          }
        );
        if (dot._element && this._dotsClipPath) this._dotsClipPath.appendChild(dot._element);
      }
    }

    if (options.shape === shapeTypes.circle) {
      const additionalDots = this._roundSize((minSize / dotSize - count) / 2);
      const fakeCount = count + additionalDots * 2;
      const xFakeBeginning = xBeginning - additionalDots * dotSize;
      const yFakeBeginning = yBeginning - additionalDots * dotSize;
      const fakeMatrix: number[][] = [];
      const center = this._roundSize(fakeCount / 2);
      for (let row = 0; row < fakeCount; row++) {
        fakeMatrix[row] = [];
        for (let col = 0; col < fakeCount; col++) {
          if (row >= additionalDots - 1 && row <= fakeCount - additionalDots && col >= additionalDots - 1 && col <= fakeCount - additionalDots) { fakeMatrix[row][col] = 0; continue; }
          if (Math.sqrt((row - center) ** 2 + (col - center) ** 2) > center) { fakeMatrix[row][col] = 0; continue; }
          fakeMatrix[row][col] = this._qr.isDark(
            col - 2 * additionalDots < 0 ? col : col >= count ? col - 2 * additionalDots : col - additionalDots,
            row - 2 * additionalDots < 0 ? row : row >= count ? row - 2 * additionalDots : row - additionalDots
          ) ? 1 : 0;
        }
      }
      for (let row = 0; row < fakeCount; row++) {
        for (let col = 0; col < fakeCount; col++) {
          if (!fakeMatrix[row][col]) continue;
          dot.draw(xFakeBeginning + col * dotSize, yFakeBeginning + row * dotSize, dotSize,
            (xOffset, yOffset) => !!fakeMatrix[row + yOffset]?.[col + xOffset]);
          if (dot._element && this._dotsClipPath) this._dotsClipPath.appendChild(dot._element);
        }
      }
    }
  }

  // ─── finder corners ─────────────────────────────────────────────────────────
  drawCorners(): void {
    if (!this._qr) throw "QR code is not defined";
    const element = this._element;
    const options = this._options;
    if (!element) throw "Element code is not defined";

    const count = this._qr.getModuleCount();
    const minSize = Math.min(options.width, options.height) - options.margin * 2;
    const realQRSize = options.shape === shapeTypes.circle ? minSize / Math.sqrt(2) : minSize;
    const dotSize = this._roundSize(realQRSize / count);
    const cornersSquareSize = dotSize * 7;
    const cornersDotSize = dotSize * 3;
    const xBeginning = this._roundSize((options.width - count * dotSize) / 2);
    const yBeginning = this._roundSize((options.height - count * dotSize) / 2);

    [[0, 0, 0], [1, 0, Math.PI / 2], [0, 1, -Math.PI / 2]].forEach(([column, row, rotation]) => {
      const x = xBeginning + column * dotSize * (count - 7);
      const y = yBeginning + row * dotSize * (count - 7);
      let cornersSquareClipPath = this._dotsClipPath;
      let cornersDotClipPath = this._dotsClipPath;

      if (options.cornersSquareOptions?.gradient || options.cornersSquareOptions?.color) {
        cornersSquareClipPath = this._window.document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
        cornersSquareClipPath.setAttribute("id", `clip-path-corners-square-color-${column}-${row}-${this._instanceId}`);
        this._defs.appendChild(cornersSquareClipPath);
        this._cornersSquareClipPath = this._cornersDotClipPath = cornersDotClipPath = cornersSquareClipPath;
        this._createColor({ options: options.cornersSquareOptions?.gradient, color: options.cornersSquareOptions?.color, additionalRotation: rotation, x, y, height: cornersSquareSize, width: cornersSquareSize, name: `corners-square-color-${column}-${row}-${this._instanceId}` });
      }

      if (options.cornersSquareOptions?.type && availableCornerSquareTypes.includes(options.cornersSquareOptions.type)) {
        const cornersSquare = new QRCornerSquare({ svg: this._element, type: options.cornersSquareOptions.type, window: this._window });
        cornersSquare.draw(x, y, cornersSquareSize, rotation);
        if (cornersSquare._element && cornersSquareClipPath) cornersSquareClipPath.appendChild(cornersSquare._element);
      } else {
        const dot = new QRDot({ svg: this._element, type: (options.cornersSquareOptions?.type as DotType) || options.dotsOptions.type, window: this._window });
        for (let r = 0; r < squareMask.length; r++) {
          for (let c = 0; c < squareMask[r].length; c++) {
            if (!squareMask[r]?.[c]) continue;
            dot.draw(x + c * dotSize, y + r * dotSize, dotSize, (xOff, yOff) => !!squareMask[r + yOff]?.[c + xOff]);
            if (dot._element && cornersSquareClipPath) cornersSquareClipPath.appendChild(dot._element);
          }
        }
      }

      if (options.cornersDotOptions?.gradient || options.cornersDotOptions?.color) {
        cornersDotClipPath = this._window.document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
        cornersDotClipPath.setAttribute("id", `clip-path-corners-dot-color-${column}-${row}-${this._instanceId}`);
        this._defs.appendChild(cornersDotClipPath);
        this._cornersDotClipPath = cornersDotClipPath;
        this._createColor({ options: options.cornersDotOptions?.gradient, color: options.cornersDotOptions?.color, additionalRotation: rotation, x: x + dotSize * 2, y: y + dotSize * 2, height: cornersDotSize, width: cornersDotSize, name: `corners-dot-color-${column}-${row}-${this._instanceId}` });
      }

      if (options.cornersDotOptions?.type && availableCornerDotTypes.includes(options.cornersDotOptions.type)) {
        const cornersDot = new QRCornerDot({ svg: this._element, type: options.cornersDotOptions.type, window: this._window });
        cornersDot.draw(x + dotSize * 2, y + dotSize * 2, cornersDotSize, rotation);
        if (cornersDot._element && cornersDotClipPath) cornersDotClipPath.appendChild(cornersDot._element);
      } else {
        const dot = new QRDot({ svg: this._element, type: (options.cornersDotOptions?.type as DotType) || options.dotsOptions.type, window: this._window });
        for (let r = 0; r < dotMask.length; r++) {
          for (let c = 0; c < dotMask[r].length; c++) {
            if (!dotMask[r]?.[c]) continue;
            dot.draw(x + c * dotSize, y + r * dotSize, dotSize, (xOff, yOff) => !!dotMask[r + yOff]?.[c + xOff]);
            if (dot._element && cornersDotClipPath) cornersDotClipPath.appendChild(dot._element);
          }
        }
      }
    });
  }

  // ─── alignment patterns (new!) ──────────────────────────────────────────────
  /**
   * Draws all QR alignment patterns (version ≥ 2) using the same style as
   * cornersSquareOptions / cornersDotOptions, giving visual consistency with
   * the three finder-pattern corners.
   */
  drawAlignmentPatterns(centers: Array<{row: number; col: number}>): void {
    if (!this._qr || centers.length === 0) return;

    const options = this._options;
    const count = this._qr.getModuleCount();
    const minSize = Math.min(options.width, options.height) - options.margin * 2;
    const realQRSize = options.shape === shapeTypes.circle ? minSize / Math.sqrt(2) : minSize;
    const dotSize = this._roundSize(realQRSize / count);
    const xBeginning = this._roundSize((options.width - count * dotSize) / 2);
    const yBeginning = this._roundSize((options.height - count * dotSize) / 2);

    // The alignment pattern is 5×5; we scale QRCornerSquare to that size.
    // QRCornerSquare internally uses size/7 for proportions – at 5×dotSize the
    // ring is ~0.71 modules thick, which is visually very close to 1 module.
    const alignmentSize = dotSize * 5;   // outer ring bounding box
    const alignmentDotSize = dotSize;    // centre dot is 1×1

    for (const center of centers) {
      // Top-left corner of this alignment pattern's 5×5 bounding box
      const x = xBeginning + (center.col - 2) * dotSize;
      const y = yBeginning + (center.row - 2) * dotSize;

      // ── outer ring ──────────────────────────────────────────────────────────
      let squareClipPath = this._dotsClipPath;

      if (options.cornersSquareOptions?.gradient || options.cornersSquareOptions?.color) {
        squareClipPath = this._window.document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
        squareClipPath.setAttribute("id", `clip-path-align-sq-color-${center.row}-${center.col}-${this._instanceId}`);
        this._defs.appendChild(squareClipPath);
        this._createColor({
          options: options.cornersSquareOptions?.gradient,
          color: options.cornersSquareOptions?.color,
          additionalRotation: 0,
          x, y,
          height: alignmentSize,
          width: alignmentSize,
          name: `align-sq-color-${center.row}-${center.col}-${this._instanceId}`
        });
      }

      if (options.cornersSquareOptions?.type && availableCornerSquareTypes.includes(options.cornersSquareOptions.type)) {
        // Draw the outer ring as a single unified path (rounded, dot, or square)
        const sq = new QRCornerSquare({ svg: this._element, type: options.cornersSquareOptions.type, window: this._window });
        sq.draw(x, y, alignmentSize, 0);
        if (sq._element && squareClipPath) squareClipPath.appendChild(sq._element);
      } else {
        // Fallback: draw individual styled dots matching the dot type
        const dot = new QRDot({ svg: this._element, type: (options.cornersSquareOptions?.type as DotType) || options.dotsOptions.type, window: this._window });
        for (let r = 0; r < alignmentSquareMask.length; r++) {
          for (let c = 0; c < alignmentSquareMask[r].length; c++) {
            if (!alignmentSquareMask[r]?.[c]) continue;
            dot.draw(x + c * dotSize, y + r * dotSize, dotSize,
              (xOff, yOff) => !!alignmentSquareMask[r + yOff]?.[c + xOff]);
            if (dot._element && squareClipPath) squareClipPath.appendChild(dot._element);
          }
        }
      }

      // ── centre dot ──────────────────────────────────────────────────────────
      let dotClipPath = squareClipPath; // inherit colour layer from outer ring

      if (options.cornersDotOptions?.gradient || options.cornersDotOptions?.color) {
        dotClipPath = this._window.document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
        dotClipPath.setAttribute("id", `clip-path-align-dot-color-${center.row}-${center.col}-${this._instanceId}`);
        this._defs.appendChild(dotClipPath);
        this._createColor({
          options: options.cornersDotOptions?.gradient,
          color: options.cornersDotOptions?.color,
          additionalRotation: 0,
          x: x + dotSize * 2,
          y: y + dotSize * 2,
          height: alignmentDotSize,
          width: alignmentDotSize,
          name: `align-dot-color-${center.row}-${center.col}-${this._instanceId}`
        });
      }

      if (options.cornersDotOptions?.type && availableCornerDotTypes.includes(options.cornersDotOptions.type)) {
        const cd = new QRCornerDot({ svg: this._element, type: options.cornersDotOptions.type, window: this._window });
        cd.draw(x + dotSize * 2, y + dotSize * 2, alignmentDotSize, 0);
        if (cd._element && dotClipPath) dotClipPath.appendChild(cd._element);
      } else {
        // Fallback: single dot using dotsOptions style
        const dot = new QRDot({ svg: this._element, type: (options.cornersDotOptions?.type as DotType) || options.dotsOptions.type, window: this._window });
        dot.draw(x + dotSize * 2, y + dotSize * 2, dotSize,
          (xOff, yOff) => !!alignmentDotMask[2 + yOff]?.[2 + xOff]);
        if (dot._element && dotClipPath) dotClipPath.appendChild(dot._element);
      }
    }
  }

  // ─── image ──────────────────────────────────────────────────────────────────
  loadImage(): Promise<void> {
    return new Promise((resolve, reject) => {
      const options = this._options;
      if (!options.image) return reject("Image is not defined");
      const image = new this._window.Image();
      if (typeof options.imageOptions.crossOrigin === "string") image.crossOrigin = options.imageOptions.crossOrigin;
      this._image = image;
      image.onload = async () => {
        if (this._options.imageOptions.saveAsBlob) this._imageUri = await toDataUrl(options.image || "", this._window);
        resolve();
      };
      image.src = options.image;
    });
  }

  async drawImage({ width, height, count, dotSize }: { width:number; height:number; count:number; dotSize:number }): Promise<void> {
    const options = this._options;
    const xBeginning = this._roundSize((options.width - count * dotSize) / 2);
    const yBeginning = this._roundSize((options.height - count * dotSize) / 2);
    const dx = xBeginning + this._roundSize(options.imageOptions.margin + (count * dotSize - width) / 2);
    const dy = yBeginning + this._roundSize(options.imageOptions.margin + (count * dotSize - height) / 2);
    const dw = width - options.imageOptions.margin * 2;
    const dh = height - options.imageOptions.margin * 2;
    const image = this._window.document.createElementNS("http://www.w3.org/2000/svg", "image");
    image.setAttribute("href", this._imageUri || "");
    image.setAttribute("xlink:href", this._imageUri || "");
    image.setAttribute("x", String(dx)); image.setAttribute("y", String(dy));
    image.setAttribute("width", `${dw}px`); image.setAttribute("height", `${dh}px`);
    this._element.appendChild(image);
  }

  // ─── colour / gradient helper ───────────────────────────────────────────────
  _createColor({ options, color, additionalRotation, x, y, height, width, name }: {
    options?: Gradient; color?: string; additionalRotation: number;
    x: number; y: number; height: number; width: number; name: string;
  }): void {
    const size = width > height ? width : height;
    const rect = this._window.document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(x)); rect.setAttribute("y", String(y));
    rect.setAttribute("height", String(height)); rect.setAttribute("width", String(width));
    rect.setAttribute("clip-path", `url('#clip-path-${name}')`);

    if (options) {
      let gradient: SVGElement;
      if (options.type === gradientTypes.radial) {
        gradient = this._window.document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
        gradient.setAttribute("id", name); gradient.setAttribute("gradientUnits", "userSpaceOnUse");
        gradient.setAttribute("fx", String(x + width / 2)); gradient.setAttribute("fy", String(y + height / 2));
        gradient.setAttribute("cx", String(x + width / 2)); gradient.setAttribute("cy", String(y + height / 2));
        gradient.setAttribute("r", String(size / 2));
      } else {
        const rotation = ((options.rotation || 0) + additionalRotation) % (2 * Math.PI);
        const positiveRotation = (rotation + 2 * Math.PI) % (2 * Math.PI);
        let x0 = x + width / 2, y0 = y + height / 2, x1 = x + width / 2, y1 = y + height / 2;
        if ((positiveRotation >= 0 && positiveRotation <= 0.25 * Math.PI) || (positiveRotation > 1.75 * Math.PI && positiveRotation <= 2 * Math.PI)) {
          x0 -= width / 2; y0 -= (height / 2) * Math.tan(rotation); x1 += width / 2; y1 += (height / 2) * Math.tan(rotation);
        } else if (positiveRotation > 0.25 * Math.PI && positiveRotation <= 0.75 * Math.PI) {
          y0 -= height / 2; x0 -= width / 2 / Math.tan(rotation); y1 += height / 2; x1 += width / 2 / Math.tan(rotation);
        } else if (positiveRotation > 0.75 * Math.PI && positiveRotation <= 1.25 * Math.PI) {
          x0 += width / 2; y0 += (height / 2) * Math.tan(rotation); x1 -= width / 2; y1 -= (height / 2) * Math.tan(rotation);
        } else {
          y0 += height / 2; x0 += width / 2 / Math.tan(rotation); y1 -= height / 2; x1 -= width / 2 / Math.tan(rotation);
        }
        gradient = this._window.document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
        gradient.setAttribute("id", name); gradient.setAttribute("gradientUnits", "userSpaceOnUse");
        gradient.setAttribute("x1", String(Math.round(x0))); gradient.setAttribute("y1", String(Math.round(y0)));
        gradient.setAttribute("x2", String(Math.round(x1))); gradient.setAttribute("y2", String(Math.round(y1)));
      }
      options.colorStops.forEach(({ offset, color: stopColor }) => {
        const stop = this._window.document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop.setAttribute("offset", `${100 * offset}%`); stop.setAttribute("stop-color", stopColor);
        gradient.appendChild(stop);
      });
      rect.setAttribute("fill", `url('#${name}')`);
      this._defs.appendChild(gradient);
    } else if (color) {
      rect.setAttribute("fill", color);
    }

    this._element.appendChild(rect);
  }

  _roundSize = (value: number) => {
    if (this._options.dotsOptions.roundSize) return Math.floor(value);
    return value;
  };
}
