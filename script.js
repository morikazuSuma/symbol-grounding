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
    // 差し替え間隔（ミリ秒）: 3秒
    INTERVAL: 3000,
    
    // 一度に差し替える枚数: 1枚
    REPLACE_COUNT: 1,
    
    // フェードアニメーション時間（ミリ秒）: ふわーんと
    FADE_DURATION: 1800,
    
    // データファイルのパス
    DATA_PATH: 'data_with_dialogs.json',
    
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
    inner.dataset.itemId = item.id;
    
    const img = document.createElement('img');
    img.src = CONFIG.IMAGE_BASE + item.image;
    img.alt = ''; // 意図的に空（テキスト情報を表示しない）
    img.draggable = false;
    
    // クリックイベント（シングルクリックで詳細表示）
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
    
    // URLとアイテムIDを更新
    inner.dataset.url = newItem.url;
    inner.dataset.itemId = newItem.id;
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
   * - ダイアログを表示してから、必要に応じてURLを開く
   */
  function handleClick(event) {
    const itemId = event.currentTarget.dataset.itemId;
    const item = items.find(i => i.id === itemId);
    
    if (!item) return;
    
    // ダイアログを表示
    showDialog(item);
  }

  // ========================================
  // ダイアログ表示
  // ========================================
  
  /**
   * ダイアログモーダルを表示
   */
  function showDialog(item) {
    // 既存のダイアログがあれば削除
    const existingDialog = document.getElementById('dialog-modal');
    if (existingDialog) {
      existingDialog.remove();
    }
    
    // モーダル要素を作成
    const modal = document.createElement('div');
    modal.id = 'dialog-modal';
    modal.className = 'modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // 閉じるボタン（右上）
    const closeButtonTop = document.createElement('button');
    closeButtonTop.className = 'modal-close-button';
    closeButtonTop.innerHTML = '&times;';
    closeButtonTop.addEventListener('click', () => {
      modal.remove();
    });
    
    // ヘッダー部分（画像・タイトル・著者・出版社）
    const header = document.createElement('div');
    header.className = 'modal-header';
    
    const bookImage = document.createElement('img');
    bookImage.src = CONFIG.IMAGE_BASE + item.image;
    bookImage.alt = item.title;
    bookImage.className = 'modal-book-image';
    
    const bookInfo = document.createElement('div');
    bookInfo.className = 'modal-book-info';
    
    const title = document.createElement('h2');
    title.textContent = item.title;
    
    const author = document.createElement('p');
    author.className = 'modal-author';
    author.textContent = item.author;
    
    const publisher = document.createElement('p');
    publisher.className = 'modal-publisher';
    publisher.textContent = item.publisher;
    
    bookInfo.appendChild(title);
    bookInfo.appendChild(author);
    bookInfo.appendChild(publisher);
    
    header.appendChild(bookImage);
    header.appendChild(bookInfo);
    
    // ダイアログ内容（カード型グリッドレイアウト）
    const dialogContent = document.createElement('div');
    dialogContent.className = 'modal-dialog-content';
    
    const cardIcons = ["🎯", "📚", "✨", "💡", "📖", "💬", "👥", "💭"];
    const cardLabels = [
      "カテゴリー",
      "構成",
      "刺さるポイント①",
      "刺さるポイント②",
      "概要",
      "著者の主張",
      "おすすめな人",
      "一言メッセージ"
    ];
    
    if (item.dialog && Array.isArray(item.dialog)) {
      // dialogが配列の場合
      item.dialog.forEach((text, index) => {
        if (text && text.trim()) {
          const card = document.createElement('div');
          card.className = 'dialog-card';
          
          const cardHeader = document.createElement('div');
          cardHeader.className = 'dialog-card-header';
          
          const icon = document.createElement('span');
          icon.className = 'dialog-card-icon';
          icon.textContent = cardIcons[index] || '📌';
          
          const label = document.createElement('h3');
          label.className = 'dialog-card-label';
          label.textContent = cardLabels[index] || `項目 ${index + 1}`;
          
          cardHeader.appendChild(icon);
          cardHeader.appendChild(label);
          
          const cardText = document.createElement('p');
          cardText.className = 'dialog-card-text';
          cardText.textContent = text;
          
          card.appendChild(cardHeader);
          card.appendChild(cardText);
          dialogContent.appendChild(card);
        }
      });
    } else if (item.dialog && typeof item.dialog === 'object') {
      // dialogがオブジェクトの場合（元の実装）
      const dialogItems = [
        { label: 'カテゴリー', key: 'category', icon: '🎯' },
        { label: '構成', key: 'why_selected', icon: '📚' },
        { label: 'この本から得られること', key: 'what_you_get', icon: '✨' },
        { label: '特に印象的だった部分', key: 'impressive_part', icon: '💡' },
        { label: 'この本をおすすめしたい人', key: 'recommended_for', icon: '👥' },
        { label: '関連する他の本', key: 'related_books', icon: '📖' },
        { label: '読後の行動提案', key: 'action_suggestion', icon: '💬' },
        { label: '一言メッセージ', key: 'one_word', icon: '💭' }
      ];
      
      dialogItems.forEach(({ label, key, icon }) => {
        if (item.dialog[key]) {
          const card = document.createElement('div');
          card.className = 'dialog-card';
          
          const cardHeader = document.createElement('div');
          cardHeader.className = 'dialog-card-header';
          
          const iconSpan = document.createElement('span');
          iconSpan.className = 'dialog-card-icon';
          iconSpan.textContent = icon;
          
          const labelH3 = document.createElement('h3');
          labelH3.className = 'dialog-card-label';
          labelH3.textContent = label;
          
          cardHeader.appendChild(iconSpan);
          cardHeader.appendChild(labelH3);
          
          const cardText = document.createElement('p');
          cardText.className = 'dialog-card-text';
          cardText.textContent = item.dialog[key];
          
          card.appendChild(cardHeader);
          card.appendChild(cardText);
          dialogContent.appendChild(card);
        }
      });
    }
    
    // ボタンエリア
    const buttonArea = document.createElement('div');
    buttonArea.className = 'modal-buttons';
    
    const openButton = document.createElement('button');
    openButton.className = 'modal-button primary';
    openButton.textContent = 'Amazonで見る';
    openButton.addEventListener('click', () => {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.openURL) {
        window.webkit.messageHandlers.openURL.postMessage(item.url);
      } else {
        window.open(item.url, '_blank', 'noopener,noreferrer');
      }
    });
    
    const closeButton = document.createElement('button');
    closeButton.className = 'modal-button secondary';
    closeButton.textContent = '閉じる';
    closeButton.addEventListener('click', () => {
      modal.remove();
    });
    
    buttonArea.appendChild(openButton);
    buttonArea.appendChild(closeButton);
    
    // すべてを組み立て
    modalContent.appendChild(closeButtonTop);
    modalContent.appendChild(header);
    modalContent.appendChild(dialogContent);
    modalContent.appendChild(buttonArea);
    modal.appendChild(modalContent);
    
    // モーダルの外側クリックで閉じる
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    // ESCキーで閉じる
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
    
    document.body.appendChild(modal);
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
