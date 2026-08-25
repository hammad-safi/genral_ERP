const Jimp = require('jimp');
const path = require('path');

async function makeCircularIcon() {
  try {
    const iconPath = path.join(__dirname, 'build', 'icon.png');
    console.log(`Reading icon from: ${iconPath}`);
    
    const image = await Jimp.read(iconPath);
    
    // Ensure it's square
    const size = Math.min(image.bitmap.width, image.bitmap.height);
    image.cover(size, size);
    
    // Create a circular mask
    const mask = new Jimp(size, size, 0x00000000); // fully transparent
    
    // Draw a white circle on the mask
    mask.scan(0, 0, size, size, function (x, y, idx) {
      const centerX = size / 2;
      const centerY = size / 2;
      const radius = size / 2;
      
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      
      // Anti-aliasing for the edge
      if (distance <= radius - 1) {
        this.bitmap.data[idx + 0] = 255;
        this.bitmap.data[idx + 1] = 255;
        this.bitmap.data[idx + 2] = 255;
        this.bitmap.data[idx + 3] = 255;
      } else if (distance <= radius) {
        const alpha = 255 * (radius - distance);
        this.bitmap.data[idx + 0] = 255;
        this.bitmap.data[idx + 1] = 255;
        this.bitmap.data[idx + 2] = 255;
        this.bitmap.data[idx + 3] = Math.round(alpha);
      }
    });

    // Apply the mask to the image
    image.mask(mask, 0, 0);
    
    // Overwrite the icon
    await image.writeAsync(iconPath);
    console.log('Successfully made icon.png circular!');
  } catch (error) {
    console.error('Failed to make icon circular:', error);
  }
}

makeCircularIcon();
