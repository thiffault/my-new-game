import { RunnerScene } from './scenes/RunnerScene';
import { AUTO, Game, Scale } from 'phaser';

const config = {
    type: AUTO,
    width: 360,
    height: 640,
    parent: 'game-container',
    backgroundColor: '#ffffff',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [RunnerScene]
};

const StartGame = (parent) => {
    return new Game({ ...config, parent });
};

export default StartGame;
