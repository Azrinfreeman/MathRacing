import * as Phaser from 'phaser';

/**
 * Everything is drawn with vector geometry and synthesised sound, so there is nothing to download. The boot
 * scene only hands over to the Ready scene, which keeps the door open for future asset loading.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.scene.start('ReadyScene');
  }
}
