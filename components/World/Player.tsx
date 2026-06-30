/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { LANE_WIDTH, GameStatus } from '../../types';
import { audio } from '../System/Audio';

// Physics Constants
const GRAVITY = 50;
const JUMP_FORCE = 16; // Results in ~2.56 height (v^2 / 2g)

// Static Geometries
const TORSO_GEO = new THREE.CylinderGeometry(0.25, 0.15, 0.6, 4);
const JETPACK_GEO = new THREE.BoxGeometry(0.3, 0.4, 0.15);
const GLOW_STRIP_GEO = new THREE.PlaneGeometry(0.05, 0.2);
const HEAD_GEO = new THREE.BoxGeometry(0.25, 0.3, 0.3);
const ARM_GEO = new THREE.BoxGeometry(0.12, 0.6, 0.12);
const JOINT_SPHERE_GEO = new THREE.SphereGeometry(0.07);
const HIPS_GEO = new THREE.CylinderGeometry(0.16, 0.16, 0.2);
const LEG_GEO = new THREE.BoxGeometry(0.15, 0.7, 0.15);
const SHADOW_GEO = new THREE.CircleGeometry(0.5, 32);
const TRAIL_PARTICLE_COUNT = 80;

export const Player: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  
  // Limb Refs for Animation
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  const { status, laneCount, takeDamage, hasDoubleJump, activateImmortality, isImmortalityActive, speed, countdown } = useStore();
  
  const [lane, setLane] = React.useState(0);
  const targetX = useRef(0);

  // Trailing Sparks particle array and refs
  const trailParticles = useMemo(() => new Array(TRAIL_PARTICLE_COUNT).fill(0).map(() => ({
    life: 0,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    color: new THREE.Color(),
    size: 0.1,
    drag: 0.96
  })), []);
  const trailMeshRef = useRef<THREE.InstancedMesh>(null);
  const trailDummy = useMemo(() => new THREE.Object3D(), []);
  
  // Physics State (using Refs for immediate logic updates)
  const isJumping = useRef(false);
  const velocityY = useRef(0);
  const jumpsPerformed = useRef(0); 
  const spinRotation = useRef(0); // For double jump flip

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const isInvincible = useRef(false);
  const lastDamageTime = useRef(0);

  // Memoized Materials
  const { armorMaterial, jointMaterial, glowMaterial, shadowMaterial } = useMemo(() => {
      const armorColor = isImmortalityActive ? '#ffd700' : '#00aaff';
      const glowColor = isImmortalityActive ? '#ffffff' : '#00ffff';
      
      return {
          armorMaterial: new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.3, metalness: 0.8 }),
          jointMaterial: new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.7, metalness: 0.5 }),
          glowMaterial: new THREE.MeshBasicMaterial({ color: glowColor }),
          shadowMaterial: new THREE.MeshBasicMaterial({ color: '#000000', opacity: 0.3, transparent: true })
      };
  }, [isImmortalityActive]); // Only recreate if immortality state changes (for color shift)

  // --- Reset State on Game Start ---
  useEffect(() => {
      if (status === GameStatus.PLAYING) {
          isJumping.current = false;
          jumpsPerformed.current = 0;
          velocityY.current = 0;
          spinRotation.current = 0;
          if (groupRef.current) groupRef.current.position.y = 0;
          if (bodyRef.current) bodyRef.current.rotation.x = 0;
      }
  }, [status]);
  
  // Safety: Clamp lane if laneCount changes (e.g. restart)
  useEffect(() => {
      const maxLane = Math.floor(laneCount / 2);
      if (Math.abs(lane) > maxLane) {
          setLane(l => Math.max(Math.min(l, maxLane), -maxLane));
      }
  }, [laneCount, lane]);

  // --- Controls (Keyboard & Touch) ---
  const triggerJump = () => {
    const maxJumps = hasDoubleJump ? 2 : 1;

    if (!isJumping.current) {
        // First Jump
        audio.playJump(false);
        isJumping.current = true;
        jumpsPerformed.current = 1;
        velocityY.current = JUMP_FORCE;
    } else if (jumpsPerformed.current < maxJumps) {
        // Double Jump (Mid-air)
        audio.playJump(true);
        jumpsPerformed.current += 1;
        velocityY.current = JUMP_FORCE; // Reset velocity upwards
        spinRotation.current = 0; // Start flip
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== GameStatus.PLAYING || countdown > 0) return;
      const maxLane = Math.floor(laneCount / 2);

      if (e.key === 'ArrowLeft') setLane(l => Math.max(l - 1, -maxLane));
      else if (e.key === 'ArrowRight') setLane(l => Math.min(l + 1, maxLane));
      else if (e.key === 'ArrowUp' || e.key === 'w') triggerJump();
      else if (e.key === ' ' || e.key === 'Enter') {
          activateImmortality();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, laneCount, hasDoubleJump, activateImmortality, countdown]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
        if (status !== GameStatus.PLAYING || countdown > 0) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;
        const maxLane = Math.floor(laneCount / 2);

        // Swipe Detection
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
             if (deltaX > 0) setLane(l => Math.min(l + 1, maxLane));
             else setLane(l => Math.max(l - 1, -maxLane));
        } else if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY < -30) {
            triggerJump();
        } else if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
            activateImmortality();
        }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [status, laneCount, hasDoubleJump, activateImmortality]);

  // --- Animation Loop ---
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (status !== GameStatus.PLAYING && status !== GameStatus.SHOP) return;

    if (countdown > 0) {
      // Snapping/positioning during countdown
      targetX.current = lane * LANE_WIDTH;
      groupRef.current.position.x = THREE.MathUtils.lerp(
          groupRef.current.position.x, 
          targetX.current, 
          delta * 15 
      );
      groupRef.current.position.y = 0;

      // Active skeletal animation to look ready
      const time = state.clock.elapsedTime * 25; 
      if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(time) * 0.7;
      if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(time + Math.PI) * 0.7;
      if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(time + Math.PI) * 1.0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(time) * 1.0;
      
      if (bodyRef.current) {
        bodyRef.current.position.y = 1.1 + Math.abs(Math.sin(time)) * 0.1;
        bodyRef.current.rotation.x = 0;
      }

      groupRef.current.rotation.z = 0;
      groupRef.current.rotation.x = 0.05;

      // Hide high speed trailing sparks
      if (trailMeshRef.current) {
        for (let i = 0; i < TRAIL_PARTICLE_COUNT; i++) {
          trailDummy.scale.set(0, 0, 0);
          trailDummy.updateMatrix();
          trailMeshRef.current.setMatrixAt(i, trailDummy.matrix);
        }
        trailMeshRef.current.instanceMatrix.needsUpdate = true;
      }
      return;
    }

    // 1. Horizontal Position
    targetX.current = lane * LANE_WIDTH;
    groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x, 
        targetX.current, 
        delta * 15 
    );

    // 2. Physics (Jump)
    if (isJumping.current) {
        // Apply Velocity
        groupRef.current.position.y += velocityY.current * delta;
        // Apply Gravity
        velocityY.current -= GRAVITY * delta;

        // Floor Collision
        if (groupRef.current.position.y <= 0) {
            groupRef.current.position.y = 0;
            isJumping.current = false;
            jumpsPerformed.current = 0;
            velocityY.current = 0;
            // Reset flip
            if (bodyRef.current) bodyRef.current.rotation.x = 0;
        }

        // Double Jump Flip
        if (jumpsPerformed.current === 2 && bodyRef.current) {
             // Rotate 360 degrees quickly
             spinRotation.current -= delta * 15;
             if (spinRotation.current < -Math.PI * 2) spinRotation.current = -Math.PI * 2;
             bodyRef.current.rotation.x = spinRotation.current;
        }
    }

    // Banking Rotation
    const xDiff = targetX.current - groupRef.current.position.x;
    groupRef.current.rotation.z = -xDiff * 0.2; 
    groupRef.current.rotation.x = isJumping.current ? 0.1 : 0.05; 

    // 3. Skeletal Animation
    const time = state.clock.elapsedTime * 25; 
    
    if (!isJumping.current) {
        // Running Cycle
        if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(time) * 0.7;
        if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(time + Math.PI) * 0.7;
        if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(time + Math.PI) * 1.0;
        if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(time) * 1.0;
        
        if (bodyRef.current) bodyRef.current.position.y = 1.1 + Math.abs(Math.sin(time)) * 0.1;
    } else {
        // Jumping Pose
        const jumpPoseSpeed = delta * 10;
        if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -2.5, jumpPoseSpeed);
        if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -2.5, jumpPoseSpeed);
        if (leftLegRef.current) leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0.5, jumpPoseSpeed);
        if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, -0.5, jumpPoseSpeed);
        
        // Only reset Y if not flipping (handled by flip logic mostly, but safe here)
        if (bodyRef.current && jumpsPerformed.current !== 2) bodyRef.current.position.y = 1.1; 
    }

    // 4. Dynamic Shadow
    if (shadowRef.current) {
        const height = groupRef.current.position.y;
        const scale = Math.max(0.2, 1 - (height / 2.5) * 0.5); // 2.5 is max jump height approx
        const runStretch = isJumping.current ? 1 : 1 + Math.abs(Math.sin(time)) * 0.3;

        shadowRef.current.scale.set(scale, scale, scale * runStretch);
        const material = shadowRef.current.material as THREE.MeshBasicMaterial;
        if (material && !Array.isArray(material)) {
            material.opacity = Math.max(0.1, 0.3 - (height / 2.5) * 0.2);
        }
    }

    // Invincibility / Immortality Effect
    const showFlicker = isInvincible.current || isImmortalityActive;
    if (showFlicker) {
        if (isInvincible.current) {
             if (Date.now() - lastDamageTime.current > 1500) {
                isInvincible.current = false;
                groupRef.current.visible = true;
             } else {
                groupRef.current.visible = Math.floor(Date.now() / 50) % 2 === 0;
             }
        } 
        if (isImmortalityActive) {
            groupRef.current.visible = true; 
        }
    } else {
        groupRef.current.visible = true;
    }

    // --- Trailing sparks emitter during movement ---
    if (status === GameStatus.PLAYING && speed > 5 && bodyRef.current) {
      // Spawn new trail sparks proportional to speed
      const spawnChance = speed * 0.015; // higher speed = more sparks
      
      // Calculate world coordinates of the left and right sides of the jetpack
      const jetpackLeft = new THREE.Vector3(-0.15, 0.2, -0.25).applyMatrix4(bodyRef.current.matrixWorld);
      const jetpackRight = new THREE.Vector3(0.15, 0.2, -0.25).applyMatrix4(bodyRef.current.matrixWorld);

      for (let s = 0; s < 2; s++) { 
        if (Math.random() < spawnChance) {
          const p = trailParticles.find(x => x.life <= 0);
          if (p) {
            p.life = 0.4 + Math.random() * 0.6; // 0.4s to 1.0s lifespan
            const spawnPos = Math.random() > 0.5 ? jetpackLeft : jetpackRight;
            p.pos.copy(spawnPos);
            
            // Vel: move backwards along Z (away from player's front) and slightly down/spread
            p.vel.set(
              (Math.random() - 0.5) * 1.5,
              (Math.random() - 0.4) * 1.2 - 0.5, // slight downward drift
              speed * 0.8 + Math.random() * 3.0 // move backward aligned with road speed
            );
            
            // Synthwave neon colors: cyan, hot pink, vivid orange, toxic green, bright purple
            const neonColors = ['#00ffff', '#ff00ff', '#ff5e00', '#00ff66', '#bd00ff', '#ffe600'];
            const randomColor = neonColors[Math.floor(Math.random() * neonColors.length)];
            p.color.set(randomColor);
            p.size = 0.05 + Math.random() * 0.08;
            p.drag = 0.94 + Math.random() * 0.04;
          }
        }
      }
    }

    // Update and draw trail sparks in InstancedMesh
    if (trailMeshRef.current) {
      const safeDelta = Math.min(delta, 0.1);
      trailParticles.forEach((p, i) => {
        if (p.life > 0) {
          p.life -= safeDelta * 1.6;
          p.pos.addScaledVector(p.vel, safeDelta);
          p.vel.multiplyScalar(p.drag); // apply personalized drag
          p.vel.y -= safeDelta * 2.0; // slight gravity pull on sparks

          trailDummy.position.copy(p.pos);
          const currentScale = Math.max(0, p.life * p.size);
          trailDummy.scale.set(currentScale, currentScale, currentScale);
          trailDummy.updateMatrix();
          
          trailMeshRef.current!.setMatrixAt(i, trailDummy.matrix);
          trailMeshRef.current!.setColorAt(i, p.color);
        } else {
          trailDummy.scale.set(0, 0, 0);
          trailDummy.updateMatrix();
          trailMeshRef.current!.setMatrixAt(i, trailDummy.matrix);
        }
      });
      trailMeshRef.current.instanceMatrix.needsUpdate = true;
      if (trailMeshRef.current.instanceColor) trailMeshRef.current.instanceColor.needsUpdate = true;
    }
  });

  // Damage Handler
  useEffect(() => {
     const checkHit = (e: any) => {
        if (isInvincible.current || isImmortalityActive) return;
        audio.playDamage(); // Play damage sound
        takeDamage();
        isInvincible.current = true;
        lastDamageTime.current = Date.now();
     };
     window.addEventListener('player-hit', checkHit);
     return () => window.removeEventListener('player-hit', checkHit);
  }, [takeDamage, isImmortalityActive]);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <group ref={bodyRef} position={[0, 1.1, 0]}> 
        
        {/* Torso */}
        <mesh castShadow position={[0, 0.2, 0]} geometry={TORSO_GEO} material={armorMaterial} />

        {/* Jetpack */}
        <mesh position={[0, 0.2, -0.2]} geometry={JETPACK_GEO} material={jointMaterial} />
        <mesh position={[-0.08, 0.1, -0.28]} geometry={GLOW_STRIP_GEO} material={glowMaterial} />
        <mesh position={[0.08, 0.1, -0.28]} geometry={GLOW_STRIP_GEO} material={glowMaterial} />

        {/* Head */}
        <group ref={headRef} position={[0, 0.6, 0]}>
            <mesh castShadow geometry={HEAD_GEO} material={armorMaterial} />
        </group>

        {/* Arms */}
        <group position={[0.32, 0.4, 0]}>
            <group ref={rightArmRef}>
                <mesh position={[0, -0.25, 0]} castShadow geometry={ARM_GEO} material={armorMaterial} />
                <mesh position={[0, -0.55, 0]} geometry={JOINT_SPHERE_GEO} material={glowMaterial} />
            </group>
        </group>
        <group position={[-0.32, 0.4, 0]}>
            <group ref={leftArmRef}>
                 <mesh position={[0, -0.25, 0]} castShadow geometry={ARM_GEO} material={armorMaterial} />
                 <mesh position={[0, -0.55, 0]} geometry={JOINT_SPHERE_GEO} material={glowMaterial} />
            </group>
        </group>

        {/* Hips */}
        <mesh position={[0, -0.15, 0]} geometry={HIPS_GEO} material={jointMaterial} />

        {/* Legs */}
        <group position={[0.12, -0.25, 0]}>
            <group ref={rightLegRef}>
                 <mesh position={[0, -0.35, 0]} castShadow geometry={LEG_GEO} material={armorMaterial} />
            </group>
        </group>
        <group position={[-0.12, -0.25, 0]}>
            <group ref={leftLegRef}>
                 <mesh position={[0, -0.35, 0]} castShadow geometry={LEG_GEO} material={armorMaterial} />
            </group>
        </group>
      </group>
      
      <mesh ref={shadowRef} position={[0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]} geometry={SHADOW_GEO} material={shadowMaterial} />

      {/* Jetpack high speed trailing sparks */}
      <instancedMesh ref={trailMeshRef} args={[undefined, undefined, TRAIL_PARTICLE_COUNT]}>
        <dodecahedronGeometry args={[0.15, 0]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
      </instancedMesh>
    </group>
  );
};