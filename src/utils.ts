import { PixelCrop, PercentCrop, Crop, Ords } from './types'


function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise(resolve => {
    canvas.toBlob(resolve)
  })
}

export const defaultCrop: PixelCrop = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  unit: 'px',
}

export function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max)
}

export function areCropsEqual(cropA: Partial<Crop>, cropB: Partial<Crop>) {
  return (
    cropA.width === cropB.width &&
    cropA.height === cropB.height &&
    cropA.x === cropB.x &&
    cropA.y === cropB.y &&
    cropA.unit === cropB.unit
  )
}

export function makeAspectCrop(crop: Partial<Crop>, aspect: number, containerWidth: number, containerHeight: number) {
  const pixelCrop = convertToPixelCrop(crop, containerWidth, containerHeight)

  if (crop.width) {
    pixelCrop.height = pixelCrop.width / aspect

  }

  if (crop.height) {
    pixelCrop.width = pixelCrop.height * aspect
  }

  if (pixelCrop.y + pixelCrop.height > containerHeight) {
    pixelCrop.height = containerHeight - pixelCrop.y
    pixelCrop.width = pixelCrop.height * aspect
  }

  if (pixelCrop.x + pixelCrop.width > containerWidth) {
    pixelCrop.width = containerWidth - pixelCrop.x
    pixelCrop.height = pixelCrop.width / aspect
  }

  if (crop.unit === '%') {
    return convertToPercentCrop(pixelCrop, containerWidth, containerHeight)
  }
  console.log(pixelCrop)
  return pixelCrop
}

export function centerCrop(crop: Partial<Crop>, containerWidth: number, containerHeight: number) {
  const pixelCrop = convertToPixelCrop(crop, containerWidth, containerHeight)

  pixelCrop.x = (containerWidth - pixelCrop.width) / 2
  pixelCrop.y = (containerHeight - pixelCrop.height) / 2

  if (crop.unit === '%') {
    return convertToPercentCrop(pixelCrop, containerWidth, containerHeight)
  }

  return pixelCrop
}

export function convertToPercentCrop(
  crop: Partial<Crop>,
  containerWidth: number,
  containerHeight: number
): PercentCrop {
  if (crop.unit === '%') {
    return { ...defaultCrop, ...crop, unit: '%' }
  }

  return {
    unit: '%',
    x: crop.x ? (crop.x / containerWidth) * 100 : 0,
    y: crop.y ? (crop.y / containerHeight) * 100 : 0,
    width: crop.width ? (crop.width / containerWidth) * 100 : 0,
    height: crop.height ? (crop.height / containerHeight) * 100 : 0,
  }
}

export function convertToPixelCrop(crop: Partial<Crop>, containerWidth: number, containerHeight: number): PixelCrop {
  if (!crop.unit) {
    return { ...defaultCrop, ...crop, unit: 'px' }
  }

  if (crop.unit === 'px') {
    return { ...defaultCrop, ...crop, unit: 'px' }
  }

  return {
    unit: 'px',
    x: crop.x ? (crop.x * containerWidth) / 100 : 0,
    y: crop.y ? (crop.y * containerHeight) / 100 : 0,
    width: crop.width ? (crop.width * containerWidth) / 100 : 0,
    height: crop.height ? (crop.height * containerHeight) / 100 : 0,
  }
}

export function containCrop(
  pixelCrop: PixelCrop,
  aspect: number,
  ord: Ords,
  containerWidth: number,
  containerHeight: number,
  minWidth = 0,
  minHeight = 0,
  maxWidth = containerWidth,
  maxHeight = containerHeight
) {
  const containedCrop = { ...pixelCrop }
  let _minWidth = minWidth
  let _minHeight = minHeight
  let _maxWidth = maxWidth
  let _maxHeight = maxHeight

  if (aspect) {
    if (aspect > 1) {
      // Landscape - increase width min + max.
      _minWidth = minHeight * aspect
      _maxWidth = maxWidth * aspect
    } else {
      // Portrait - increase height min + max.
      _minHeight = minWidth / aspect
      _maxHeight = maxHeight / aspect
    }
  }

  // Stop underflow on top.
  if (containedCrop.y < 0) {
    containedCrop.height = Math.max(containedCrop.height + containedCrop.y, _minHeight)
    containedCrop.y = 0
  }

  // Stop underflow on left.
  if (containedCrop.x < 0) {
    containedCrop.width = Math.max(containedCrop.width + containedCrop.x, _minWidth)
    containedCrop.x = 0
  }

  // Stop overflow on right.
  const xOverflow = containerWidth - (containedCrop.x + containedCrop.width)
  if (xOverflow < 0) {
    containedCrop.x = Math.min(containedCrop.x, containerWidth - _minWidth)
    containedCrop.width += xOverflow
  }

  // Stop overflow on bottom.
  const yOverflow = containerHeight - (containedCrop.y + containedCrop.height)
  if (yOverflow < 0) {
    containedCrop.y = Math.min(containedCrop.y, containerHeight - _minHeight)
    containedCrop.height += yOverflow
  }

  // Make crop respect min width generally.
  if (containedCrop.width < _minWidth) {
    if (ord === 'sw' || ord == 'nw') {
      // Stops box moving when min is hit.
      containedCrop.x -= _minWidth - containedCrop.width
    }
    containedCrop.width = _minWidth
  }

  // Make crop respect min height generally.
  if (containedCrop.height < _minHeight) {
    if (ord === 'nw' || ord == 'ne') {
      // Stops box moving when min is hit.
      containedCrop.y -= _minHeight - containedCrop.height
    }
    containedCrop.height = _minHeight
  }

  // Make crop respect max width generally.
  if (containedCrop.width > _maxWidth) {
    if (ord === 'sw' || ord == 'nw') {
      // Stops box moving when max is hit.
      containedCrop.x -= _maxWidth - containedCrop.width
    }
    containedCrop.width = _maxWidth
  }

  // Make crop respect max height generally.
  if (containedCrop.height > _maxHeight) {
    if (ord === 'nw' || ord == 'ne') {
      // Stops box moving when min is hit.
      containedCrop.y -= _maxHeight - containedCrop.height
    }
    containedCrop.height = _maxHeight
  }

  // Maintain aspect after size fixing.
  if (aspect) {
    const currAspect = containedCrop.width / containedCrop.height
    if (currAspect < aspect) {
      // Crop is shrunk on the width so adjust the height.
      const newHeight = containedCrop.width / aspect

      if (ord === 'nw' || ord == 'ne') {
        // Stops box moving when min is hit.
        containedCrop.y -= newHeight - containedCrop.height
      }

      containedCrop.height = newHeight
    } else if (currAspect > aspect) {
      // Crop is shrunk on the height so adjust the width.
      const newWidth = containedCrop.height * aspect

      if (ord === 'sw' || ord == 'nw') {
        // Stops box moving when max is hit.
        containedCrop.x -= newWidth - containedCrop.width
      }

      containedCrop.width = newWidth
    }
  }

  return containedCrop
}

export async function cropPreview(image: HTMLImageElement, crop: PixelCrop, scale = 1, rotate = 0) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('No 2d context')
  }

  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  // const pixelRatio = window.devicePixelRatio || 1
  const pixelRatio = 1

  canvas.width = Math.floor(crop.width * scaleX * pixelRatio)
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio)

  ctx.scale(pixelRatio, pixelRatio)
  ctx.imageSmoothingQuality = 'high'

  const cropX = crop.x * scaleX
  const cropY = crop.y * scaleY

  const rotateRads = rotate * (Math.PI / 180)
  const centerX = image.naturalWidth / 2
  const centerY = image.naturalHeight / 2

  ctx.save()

  // 5) Move the crop origin to the canvas origin (0,0)
  ctx.translate(-cropX, -cropY)
  // 4) Move the origin to the center of the original position
  ctx.translate(centerX, centerY)
  // 3) Rotate around the origin
  ctx.rotate(rotateRads)
  // 2) Scaled the image
  ctx.scale(scale, scale)
  // 1) Move the center of the image to the origin (0,0)
  ctx.translate(-centerX, -centerY)
  ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, image.naturalWidth, image.naturalHeight)

  ctx.restore()

  const blob = await toBlob(canvas)
  if (!blob) {
    return ''
  }

  return URL.createObjectURL(blob)
}
