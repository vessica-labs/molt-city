import * as THREE from 'three';
export type DriftSprite = {
    sprite: THREE.Sprite;
    baseY: number;
    speed: number;
    phase: number;
    rangeX: [number, number];
};
export type EnvironmentHandles = {
    waterMaterial: THREE.ShaderMaterial;
    clouds: DriftSprite[];
    fogBanks: DriftSprite[];
    turbineRotors: THREE.Object3D[];
};
export declare function createEnvironment(group: THREE.Group): EnvironmentHandles;
