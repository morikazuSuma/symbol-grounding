/**
 * 記号接地待ちスクリーンセイバー - script.js
 * 
 * 【設計思想】
 * - 0.5秒間隔で、1枚の画像が入れ替わる
 * - 全体一括切り替えは禁止
 * - クリックは「確認行為」であり、行動の開始ではない
 * - 状態（クリック履歴等）を保存しない
 * 
 * 【禁止事項】
 * - レコメンド・最適化ロジック
 * - クリック履歴の記録
 * - 表示頻度の偏り補正
 * - 進捗・統計の計測
 */

(function() {
  'use strict';

  // ========================================
  // 設定値（最小限に留める）
  // ========================================
  const CONFIG = {
    // 差し替え間隔（ミリ秒）: 0.5秒固定
    INTERVAL: 500,
    
    // 一度に差し替える枚数: 1枚
    REPLACE_COUNT: 1,
    
    // フェードアニメーション時間（ミリ秒）
    FADE_DURATION: 300,
    
    // データファイルのパス
    DATA_PATH: 'data.json',
    
    // 画像パスのベース
    IMAGE_BASE: '',
    
    // レスポンシブ列数
    COLUMNS: {
      DESKTOP: 14,  // > 1200px
      TABLET: 8,    // 601-1200px
      MOBILE: 3     // <= 600px
    }
  };

  // ========================================
  // 状態（最小限、永続化しない）
  // ========================================
  let items = [];        // 全アイテムリスト
  let gridCells = [];    // グリッドセル要素
  let cellAssignments = new Map(); // セル → 現在表示中のアイテムID

  // ========================================
  // ユーティリティ
  // ========================================
  
  /**
   * 範囲内のランダム整数を返す
   */
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 配列からランダムに1つ選ぶ
   */
  function randomPick(array) {
    return array[randomInt(0, array.length - 1)];
  }

  /**
   * 配列をシャッフル（Fisher-Yates）
   */
  function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = randomInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // ========================================
  // グリッド構築
  // ========================================
  
  /**
   * 画面サイズに基づいて列数を取得
   */
  function getColumns() {
    const width = window.innerWidth;
    if (width <= 600) return CONFIG.COLUMNS.MOBILE;
    if (width <= 1200) return CONFIG.COLUMNS.TABLET;
    return CONFIG.COLUMNS.DESKTOP;
  }

  /**
   * 画面サイズに基づいてグリッドセル数を計算
   */
  function calculateGridSize() {
    const cols = getColumns();
    const cellWidth = window.innerWidth / cols;
    const cellHeight = cellWidth * 1.5; // 2:3 の比率
    const rows = Math.ceil(window.innerHeight / cellHeight) + 1;
    return cols * rows;
  }

  /**
   * グリッドを初期化
   */
  function initGrid() {
    const grid = document.getElementById('grid');
    const cellCount = calculateGridSize();
    
    // アイテムが足りない場合は繰り返し使用
    const shuffledItems = shuffle(items);
    
    for (let i = 0; i < cellCount; i++) {
      const item = shuffledItems[i % shuffledItems.length];
      const cell = createCell(item);
      grid.appendChild(cell);
      gridCells.push(cell);
      cellAssignments.set(cell, item.id);
    }
  }

  /**
   * セル要素を生成
   */
  function createCell(item) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    
    const inner = document.createElement('div');
    inner.className = 'cell-inner';
    inner.dataset.url = item.url;
    
    const img = document.createElement('img');
    img.src = CONFIG.IMAGE_BASE + item.image;
    img.alt = ''; // 意図的に空（テキスト情報を表示しない）
    img.draggable = false;
    
    // クリックイベント（シングルクリックで新タブ）
    inner.addEventListener('click', handleClick);
    
    inner.appendChild(img);
    cell.appendChild(inner);
    
    return cell;
  }

  // ========================================
  // 画像差し替え
  // ========================================
  
  /**
   * ランダムなセルの画像を差し替える
   */
  function replaceRandomCells() {
    const targetCells = shuffle(gridCells).slice(0, CONFIG.REPLACE_COUNT);
    
    targetCells.forEach(cell => {
      // 現在表示中でないアイテムからランダムに選ぶ
      const currentId = cellAssignments.get(cell);
      const candidates = items.filter(item => item.id !== currentId);
      
      if (candidates.length === 0) return;
      
      const newItem = randomPick(candidates);
      replaceCell(cell, newItem);
    });
  }

  /**
   * 単一セルの画像を差し替える（フェードアニメーション付き）
   */
  function replaceCell(cell, newItem) {
    const inner = cell.querySelector('.cell-inner');
    const oldImg = inner.querySelector('img');
    
    // 新しい画像を準備
    const newImg = document.createElement('img');
    newImg.src = CONFIG.IMAGE_BASE + newItem.image;
    newImg.alt = '';
    newImg.draggable = false;
    newImg.style.opacity = '0';
    newImg.style.position = 'absolute';
    newImg.style.top = '0';
    newImg.style.left = '0';
    
    // 新しい画像を追加
    inner.appendChild(newImg);
    
    // URLを更新
    inner.dataset.url = newItem.url;
    cellAssignments.set(cell, newItem.id);
    
    // アニメーション開始（次フレームで）
    requestAnimationFrame(() => {
      oldImg.style.opacity = '0';
      newImg.style.opacity = '1';
      
      // アニメーション完了後に古い画像を削除
      setTimeout(() => {
        oldImg.remove();
        newImg.style.position = '';
        newImg.style.top = '';
        newImg.style.left = '';
      }, CONFIG.FADE_DURATION);
    });
  }

  // ========================================
  // クリック処理
  // ========================================
  
  /**
   * クリックハンドラ
   * 
   * 【重要】
   * - 履歴を保存しない
   * - 状態を変更しない
   * - ただURLを開くだけ
   */
  function handleClick(event) {
    const url = event.currentTarget.dataset.url;
    
    if (!url) return;
    
    // ネイティブ連携（WKWebView環境）
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.openURL) {
      window.webkit.messageHandlers.openURL.postMessage(url);
    } else {
      // ブラウザで新タブを開く
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  // ========================================
  // 初期化
  // ========================================
  
  /**
   * データを読み込んで初期化
   */
  async function init() {
    try {
      const response = await fetch(CONFIG.DATA_PATH);
      
      if (!response.ok) {
        throw new Error(`データ読み込み失敗: ${response.status}`);
      }
      
      items = await response.json();
      
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('有効なデータがありません');
      }
      
      // グリッド初期化
      initGrid();
      
      // 差し替えサイクル開始（0.5秒間隔）
      setInterval(replaceRandomCells, CONFIG.INTERVAL);
      
    } catch (error) {
      // エラー時は黒画面のまま（スピナーやエラー表示は出さない）
      console.error('[記号接地待ち]', error.message);
    }
  }

  // DOMContentLoaded で初期化
  document.addEventListener('DOMContentLoaded', init);

})();
