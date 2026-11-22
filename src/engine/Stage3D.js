/**
 * Three.js 3D 舞台引擎
 * - Dark Atelier 微光網格地板與燈光
 * - PerspectiveCamera / OrthographicCamera 平滑雙相機切換（支援 2D 俯視卡片錯覺）
 * - CSS2DRenderer 空間標註疊層
 * - OrbitControls、ResizeObserver 與 resetCamera()
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { gsap } from 'gsap';
import { COLORS, RENDER_ORDER } from '../core/constants.js';

const DEFAULT_CAMERA_POS = new THREE.Vector3(5.2, 4.6, 8.2);
const DEFAULT_TARGET = new THREE.Vector3(0.5, 0.35, 0);

export class Stage3D {
  /**
   * @param {HTMLElement} container
   * @param {{ onCameraModeSync?: (mode: 'perspective' | 'orthographic') => void, onHoverToken?: (token: string | null) => void }} [callbacks]
   */
  constructor(container, callbacks = {}) {
    this.container = container;
    this.onCameraModeSync = typeof callbacks === 'function' ? callbacks : callbacks.onCameraModeSync || null;
    this.onHoverToken = typeof callbacks === 'object' ? callbacks.onHoverToken || null : null;
    this._homePos = DEFAULT_CAMERA_POS.clone();
    this._homeTarget = DEFAULT_TARGET.clone();
    this._cameraMode = 'perspective';
    this._isTransitioning = false;
    this._rafId = null;
    this._raycaster = new THREE.Raycaster();
    this._pointerNdc = new THREE.Vector2();
    this._pointerInside = false;
    this._lastRaycastToken = null;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const aspect = width / height;

    // 1. 場景與背景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.bgHex);
    this.scene.fog = new THREE.FogExp2(COLORS.bgHex, 0.018);

    // 2. 雙相機（透視 + 正交）
    this.perspCamera = new THREE.PerspectiveCamera(44, aspect, 0.1, 200);
    this.perspCamera.position.copy(DEFAULT_CAMERA_POS);

    this.orthoCamera = new THREE.OrthographicCamera(-5 * aspect, 5 * aspect, 5, -5, 0.1, 200);
    this.orthoCamera.position.set(DEFAULT_TARGET.x, 10, DEFAULT_TARGET.z + 0.001);

    this.activeCamera = this.perspCamera;

    // 3. WebGLRenderer 與 CSS2DRenderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(width, height);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.inset = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    this.container.appendChild(this.labelRenderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.activeCamera, this.renderer.domElement);
    this.controls.target.copy(DEFAULT_TARGET);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.49; // 防止穿到地板下方
    this.controls.minDistance = 2;
    this.controls.maxDistance = 36;
    this.controls.update();

    // 5. 燈光與微光網格地板
    this._setupLights();
    this._setupBlueprintFloor();

    // 6. 模組掛載根節點
    this.moduleRoot = new THREE.Group();
    this.moduleRoot.name = 'ModuleRoot';
    this.scene.add(this.moduleRoot);

    // 7. 響應式 ResizeObserver 與 Raycaster 懸停偵測
    this._resizeObserver = new ResizeObserver(() => this._handleResize());
    this._resizeObserver.observe(this.container);

    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerLeave = this._onPointerLeave.bind(this);
    this.renderer.domElement.addEventListener('pointermove', this._onPointerMove);
    this.renderer.domElement.addEventListener('pointerleave', this._onPointerLeave);

    this._animate = this._animate.bind(this);
    this._animate();
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0xdbeafe, 0.72);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
    keyLight.position.set(8, 14, 10);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rimLight.position.set(-10, 6, -8);
    this.scene.add(rimLight);
  }

  _setupBlueprintFloor() {
    this.floorGroup = new THREE.Group();

    // 微細網格
    const minorGrid = new THREE.GridHelper(24, 48, COLORS.gridMinor, COLORS.gridMinor);
    minorGrid.position.y = -0.002;
    minorGrid.renderOrder = RENDER_ORDER.GRID;
    this.floorGroup.add(minorGrid);

    // 主刻度網格
    const majorGrid = new THREE.GridHelper(24, 12, COLORS.gridMajor, COLORS.gridMajor);
    majorGrid.position.y = -0.001;
    majorGrid.renderOrder = RENDER_ORDER.GRID;
    this.floorGroup.add(majorGrid);

    // X 軸數線光條（y = 0）
    const axisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-10, 0.003, 0),
      new THREE.Vector3(12, 0.003, 0)
    ]);
    const axisMat = new THREE.LineBasicMaterial({
      color: COLORS.axisLine,
      transparent: true,
      opacity: 0.65
    });
    const xAxis = new THREE.Line(axisGeo, axisMat);
    xAxis.renderOrder = RENDER_ORDER.GRID;
    this.floorGroup.add(xAxis);

    // 原點 0 標記環
    const originRingGeo = new THREE.RingGeometry(0.11, 0.15, 32);
    originRingGeo.rotateX(-Math.PI / 2);
    const originRingMat = new THREE.MeshBasicMaterial({
      color: COLORS.axisLine,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const originRing = new THREE.Mesh(originRingGeo, originRingMat);
    originRing.position.set(0, 0.004, 0);
    originRing.renderOrder = RENDER_ORDER.GRID;
    this.floorGroup.add(originRing);

    this.scene.add(this.floorGroup);
  }

  getModuleRoot() {
    return this.moduleRoot;
  }

  /**
   * 設定目前模組偏好的預設相機位置與注視點，並平滑切換過去
   * @param {[number, number, number]} pos
   * @param {[number, number, number]} target
   */
  setCameraHome(pos, target) {
    this._homePos.set(pos[0], pos[1], pos[2]);
    this._homeTarget.set(target[0], target[1], target[2]);
    if (this._cameraMode === 'perspective') {
      this.resetCamera();
    }
  }

  _onPointerMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this._pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._pointerInside = true;
    this._pickHoverToken();
  }

  _onPointerLeave() {
    this._pointerInside = false;
    if (this._lastRaycastToken !== null) {
      this._lastRaycastToken = null;
      if (this.onHoverToken) this.onHoverToken(null);
    }
  }

  _pickHoverToken() {
    if (!this._pointerInside || !this.onHoverToken) return;
    this._raycaster.setFromCamera(this._pointerNdc, this.activeCamera);
    const hits = this._raycaster.intersectObjects(this.moduleRoot.children, true);
    let foundToken = null;
    for (const hit of hits) {
      let cur = hit.object;
      while (cur && cur !== this.moduleRoot) {
        if (!cur.visible) {
          foundToken = null;
          break;
        }
        if (cur.userData && cur.userData.token) {
          foundToken = cur.userData.token;
          break;
        }
        cur = cur.parent;
      }
      if (foundToken) break;
    }

    if (foundToken !== this._lastRaycastToken) {
      this._lastRaycastToken = foundToken;
      this.renderer.domElement.style.cursor = foundToken ? 'pointer' : 'grab';
      this.onHoverToken(foundToken);
    }
  }

  _updateOrthoFrustum(distance) {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const aspect = width / height;
    const halfH = distance * Math.tan(THREE.MathUtils.degToRad(this.perspCamera.fov * 0.5));
    const halfW = halfH * aspect;

    this.orthoCamera.left = -halfW;
    this.orthoCamera.right = halfW;
    this.orthoCamera.top = halfH;
    this.orthoCamera.bottom = -halfH;
    this.orthoCamera.updateProjectionMatrix();
  }

  /**
   * 切換透視／正交雙相機
   * @param {'perspective' | 'orthographic'} mode
   */
  setCameraMode(mode) {
    if (mode === this._cameraMode && !this._isTransitioning) return;

    gsap.killTweensOf(this.perspCamera.position);
    gsap.killTweensOf(this.controls.target);
    this._cameraMode = mode;

    if (mode === 'orthographic') {
      this._isTransitioning = true;
      const target = this.controls.target.clone();
      const dist = Math.max(4.5, this.perspCamera.position.distanceTo(target));

      // 先以 GSAP 平滑移動透視鏡頭至正上方，抵達瞬間無縫切換正交相機
      gsap.to(this.perspCamera.position, {
        x: target.x,
        y: target.y + dist,
        z: target.z + 0.001, // 避免正對 -Y 時 LookAt 萬向鎖
        duration: 0.72,
        ease: 'power2.inOut',
        onUpdate: () => {
          this.perspCamera.lookAt(target);
        },
        onComplete: () => {
          this._updateOrthoFrustum(dist);
          this.orthoCamera.position.set(target.x, target.y + dist, target.z + 0.001);
          this.orthoCamera.zoom = 1;
          this.orthoCamera.lookAt(target);
          this.orthoCamera.updateProjectionMatrix();

          this.activeCamera = this.orthoCamera;
          this.controls.object = this.orthoCamera;
          this.controls.enableRotate = false;
          this.controls.update();
          this._isTransitioning = false;
        }
      });
    } else {
      this._isTransitioning = true;
      const target = this.controls.target.clone();
      // 從正交相機還原透視相機起始位置後再滑回標準 3D 視角
      this.perspCamera.position.set(target.x, target.y + 8, target.z + 0.001);
      this.activeCamera = this.perspCamera;
      this.controls.object = this.perspCamera;
      this.controls.enableRotate = true;

      gsap.to(this.perspCamera.position, {
        x: this._homePos.x,
        y: this._homePos.y,
        z: this._homePos.z,
        duration: 0.72,
        ease: 'power2.inOut',
        onUpdate: () => {
          this.controls.update();
        },
        onComplete: () => {
          this._isTransitioning = false;
        }
      });
    }
  }

  /**
   * 重置鏡頭至預設 3D 透視角度
   */
  resetCamera() {
    gsap.killTweensOf(this.perspCamera.position);
    gsap.killTweensOf(this.controls.target);

    if (this._cameraMode !== 'perspective') {
      this._cameraMode = 'perspective';
      this.activeCamera = this.perspCamera;
      this.controls.object = this.perspCamera;
      this.controls.enableRotate = true;
      if (this.onCameraModeSync) {
        this.onCameraModeSync('perspective');
      }
    }

    this._isTransitioning = true;
    gsap.to(this.perspCamera.position, {
      x: this._homePos.x,
      y: this._homePos.y,
      z: this._homePos.z,
      duration: 0.65,
      ease: 'power2.out'
    });
    gsap.to(this.controls.target, {
      x: this._homeTarget.x,
      y: this._homeTarget.y,
      z: this._homeTarget.z,
      duration: 0.65,
      ease: 'power2.out',
      onUpdate: () => {
        this.controls.update();
      },
      onComplete: () => {
        this._isTransitioning = false;
      }
    });
  }

  _handleResize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const aspect = width / height;

    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();

    if (this._cameraMode === 'orthographic') {
      const dist = this.orthoCamera.position.distanceTo(this.controls.target);
      this._updateOrthoFrustum(dist);
    }

    this.renderer.setSize(width, height);
    this.labelRenderer.setSize(width, height);
  }

  _animate() {
    this._rafId = requestAnimationFrame(this._animate);
    this.controls.update();
    this.renderer.render(this.scene, this.activeCamera);
    this.labelRenderer.render(this.scene, this.activeCamera);
  }

  dispose() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
    }
    this.renderer.domElement.removeEventListener('pointermove', this._onPointerMove);
    this.renderer.domElement.removeEventListener('pointerleave', this._onPointerLeave);
    this._resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
