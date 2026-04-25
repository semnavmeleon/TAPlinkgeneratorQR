interface ImageSizeOptions { originalHeight:number; originalWidth:number; maxHiddenDots:number; maxHiddenAxisDots?:number; dotSize:number; }
interface ImageSizeResult { height:number; width:number; hideYDots:number; hideXDots:number; }

export default function calculateImageSize({ originalHeight, originalWidth, maxHiddenDots, maxHiddenAxisDots, dotSize }: ImageSizeOptions): ImageSizeResult {
  const hideDots = { x: 0, y: 0 };
  const imageSize = { x: 0, y: 0 };
  if (originalHeight <= 0 || originalWidth <= 0 || maxHiddenDots <= 0 || dotSize <= 0) return { height:0, width:0, hideYDots:0, hideXDots:0 };
  const k = originalHeight / originalWidth;
  hideDots.x = Math.floor(Math.sqrt(maxHiddenDots / k));
  if (hideDots.x <= 0) hideDots.x = 1;
  if (maxHiddenAxisDots && maxHiddenAxisDots < hideDots.x) hideDots.x = maxHiddenAxisDots;
  if (hideDots.x % 2 === 0) hideDots.x--;
  imageSize.x = hideDots.x * dotSize;
  hideDots.y = 1 + 2 * Math.ceil((hideDots.x * k - 1) / 2);
  imageSize.y = Math.round(imageSize.x * k);
  if (hideDots.y * hideDots.x > maxHiddenDots || (maxHiddenAxisDots && maxHiddenAxisDots < hideDots.y)) {
    if (maxHiddenAxisDots && maxHiddenAxisDots < hideDots.y) { hideDots.y = maxHiddenAxisDots; if (hideDots.y % 2 === 0) hideDots.x--; }
    else { hideDots.y -= 2; }
    imageSize.y = hideDots.y * dotSize;
    hideDots.x = 1 + 2 * Math.ceil((hideDots.y / k - 1) / 2);
    imageSize.x = Math.round(imageSize.y / k);
  }
  return { height: imageSize.y, width: imageSize.x, hideYDots: hideDots.y, hideXDots: hideDots.x };
}
