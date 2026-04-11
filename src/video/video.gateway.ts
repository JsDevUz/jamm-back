import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { InjectModel } from '@nestjs/mongoose';
import { Namespace, Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { PremiumService } from '../premium/premium.service';
import {
  APP_LIMITS,
  APP_TEXT_LIMITS,
  getTierLimit,
} from '../common/limits/app-limits';
import { getAllowedOrigins } from '../common/config/cors.config';
import { verifySocketToken } from '../common/auth/ws-auth.util';
import { SocketRateLimiter } from '../common/ws/socket-rate-limiter';
import { Chat, ChatDocument } from '../chats/schemas/chat.schema';

interface KnockEntry {
  peerKey: string;
  displayName: string;
  socket: Socket;
}

interface WhiteboardPoint {
  x: number;
  y: number;
}

type WhiteboardTool =
  | 'pen'
  | 'eraser'
  | 'text'
  | 'arrow'
  | 'rectangle'
  | 'diamond'
  | 'triangle'
  | 'circle';
type WhiteboardTabType = 'board' | 'pdf';
type WhiteboardTextFontFamily = 'sans' | 'serif' | 'mono' | 'hand';
type WhiteboardTextSize = 's' | 'm' | 'l' | 'xl';
type WhiteboardTextAlign = 'left' | 'center' | 'right';
type WhiteboardShapeEdge = 'sharp' | 'rounded';

interface WhiteboardStroke {
  id: string;
  tool: WhiteboardTool;
  color: string;
  size: number;
  points: WhiteboardPoint[];
  text?: string;
  fillColor?: string;
  fontFamily?: WhiteboardTextFontFamily;
  textSize?: WhiteboardTextSize;
  textAlign?: WhiteboardTextAlign;
  fontPixelSize?: number;
  edgeStyle?: WhiteboardShapeEdge;
  rotation?: number;
  createdAt: number;
}

interface WhiteboardPdfPageState {
  pageNumber: number;
  strokes: WhiteboardStroke[];
  undoStack: WhiteboardStroke[][];
  redoStack: WhiteboardStroke[][];
}

interface WhiteboardBoardTab {
  id: string;
  type: 'board';
  title: string;
  zoom: number;
  viewportBaseWidth: number;
  viewportBaseHeight: number;
  strokes: WhiteboardStroke[];
  undoStack: WhiteboardStroke[][];
  redoStack: WhiteboardStroke[][];
}

interface WhiteboardPdfTab {
  id: string;
  type: 'pdf';
  title: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  scrollRatio: number;
  zoom: number;
  viewportPageNumber: number;
  viewportPageOffsetRatio: number;
  viewportLeftRatio: number;
  viewportVisibleHeightRatio: number;
  viewportVisibleWidthRatio: number;
  viewportBaseWidth: number;
  selectedPagesMode: 'all' | 'custom';
  selectedPages: number[];
  pages: WhiteboardPdfPageState[];
}

interface WhiteboardPdfLibraryItem {
  id: string;
  title: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  createdAt: number;
}

type WhiteboardTab = WhiteboardBoardTab | WhiteboardPdfTab;
type WhiteboardHistoryTarget = WhiteboardBoardTab | WhiteboardPdfPageState;

interface WhiteboardState {
  isActive: boolean;
  ownerPeerId: string;
  ownerUserId?: string;
  activeTabId: string;
  tabs: WhiteboardTab[];
  pdfLibrary: WhiteboardPdfLibraryItem[];
  updatedAt: number;
}

interface RoomInfo {
  peers: Map<string, string>; // socketId -> displayName
  peerUsers: Map<string, string>; // socketId -> userId
  isPrivate: boolean;
  title: string;
  participantLimit: number;
  creatorSocketId: string;
  creatorUserId?: string;
  knockQueue: Map<string, KnockEntry>;
  disconnectTimers: Map<string, NodeJS.Timeout>;
  whiteboard: WhiteboardState;
}

const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{4,128}$/;
const DISCONNECT_GRACE_MS = 7000;
const WHITEBOARD_STROKE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const WHITEBOARD_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const WHITEBOARD_MIN_BRUSH_SIZE = 2;
const WHITEBOARD_MAX_BRUSH_SIZE = 24;
const WHITEBOARD_MAX_STROKES = 320;
const WHITEBOARD_MAX_POINTS_PER_STROKE = 1200;
const WHITEBOARD_APPEND_BATCH_LIMIT = 24;
const WHITEBOARD_BOARD_TAB_ID = 'board';
const WHITEBOARD_TAB_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const WHITEBOARD_MAX_TABS = 6;
const WHITEBOARD_MAX_PAGE_STATES = 120;
const WHITEBOARD_MAX_FILE_NAME_CHARS = 120;
const WHITEBOARD_MAX_FILE_URL_CHARS = 2048;
const WHITEBOARD_MAX_LIBRARY_ITEMS = 24;
const WHITEBOARD_MIN_ZOOM = 0.5;
const WHITEBOARD_MAX_ZOOM = 3;
const WHITEBOARD_BOARD_POINT_MIN = -0.5;
const WHITEBOARD_BOARD_POINT_MAX = 1.5;
const WHITEBOARD_MIN_VIEWPORT_BASE_WIDTH = 120;
const WHITEBOARD_MAX_VIEWPORT_BASE_WIDTH = 4096;
const WHITEBOARD_MIN_VIEWPORT_BASE_HEIGHT = 120;
const WHITEBOARD_MAX_VIEWPORT_BASE_HEIGHT = 4096;
const WHITEBOARD_MAX_HISTORY_ENTRIES = 48;
const WHITEBOARD_MAX_SELECTED_PAGES = 240;
const WHITEBOARD_MAX_TEXT_CHARS = 240;
const WHITEBOARD_TEXT_FONT_FAMILY_OPTIONS: WhiteboardTextFontFamily[] = [
  'sans',
  'serif',
  'mono',
  'hand',
];
const WHITEBOARD_TEXT_SIZE_OPTIONS: WhiteboardTextSize[] = ['s', 'm', 'l', 'xl'];
const WHITEBOARD_TEXT_ALIGN_OPTIONS: WhiteboardTextAlign[] = [
  'left',
  'center',
  'right',
];
const WHITEBOARD_SHAPE_EDGE_OPTIONS: WhiteboardShapeEdge[] = [
  'sharp',
  'rounded',
];

const createWhiteboardBoardTab = (): WhiteboardBoardTab => ({
  id: WHITEBOARD_BOARD_TAB_ID,
  type: 'board',
  title: 'board',
  zoom: 1,
  viewportBaseWidth: WHITEBOARD_MIN_VIEWPORT_BASE_WIDTH,
  viewportBaseHeight: WHITEBOARD_MIN_VIEWPORT_BASE_HEIGHT,
  strokes: [],
  undoStack: [],
  redoStack: [],
});

const createDefaultWhiteboardState = (): WhiteboardState => ({
  isActive: false,
  ownerPeerId: '',
  ownerUserId: '',
  activeTabId: WHITEBOARD_BOARD_TAB_ID,
  tabs: [createWhiteboardBoardTab()],
  pdfLibrary: [],
  updatedAt: Date.now(),
});

const getWhiteboardPdfLibraryBytes = (
  items: WhiteboardPdfLibraryItem[] | undefined,
): number =>
  (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + Math.max(0, Number(item?.fileSize || 0)),
    0,
  );

@WebSocketGateway({
  cors: {
    origin: getAllowedOrigins(),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/video',
})
export class VideoGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server | Namespace;

  private rooms = new Map<string, RoomInfo>();
  private readonly rateLimiter = new SocketRateLimiter();

  constructor(
    @InjectModel(Chat.name)
    private readonly chatModel: Model<ChatDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly premiumService: PremiumService,
  ) {}

  private sanitizeDisplayName(rawValue: unknown): string {
    const value =
      typeof rawValue === 'string'
        ? rawValue
            .replace(/[\u0000-\u001F\u007F]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        : '';

    return value.slice(0, 60) || 'Guest';
  }

  private sanitizeRoomTitle(rawValue: unknown): string {
    if (typeof rawValue !== 'string') return '';

    return rawValue
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, APP_TEXT_LIMITS.meetTitleChars);
  }

  private sanitizeWhiteboardPoint(rawValue: unknown): WhiteboardPoint | null {
    if (!rawValue || typeof rawValue !== 'object') {
      return null;
    }

    const point = rawValue as Record<string, unknown>;
    const x = Number(point.x);
    const y = Number(point.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }

    return {
      x: Math.min(WHITEBOARD_BOARD_POINT_MAX, Math.max(WHITEBOARD_BOARD_POINT_MIN, x)),
      y: Math.min(WHITEBOARD_BOARD_POINT_MAX, Math.max(WHITEBOARD_BOARD_POINT_MIN, y)),
    };
  }

  private sanitizeWhiteboardPoints(
    rawValue: unknown,
    limit = WHITEBOARD_APPEND_BATCH_LIMIT,
  ): WhiteboardPoint[] {
    if (!Array.isArray(rawValue)) {
      return [];
    }

    return rawValue
      .slice(0, limit)
      .map((point) => this.sanitizeWhiteboardPoint(point))
      .filter((point): point is WhiteboardPoint => Boolean(point));
  }

  private sanitizeWhiteboardTool(rawValue: unknown): WhiteboardTool {
    if (rawValue === 'eraser') {
      return 'eraser';
    }

    if (rawValue === 'text') {
      return 'text';
    }

    if (
      rawValue === 'arrow' ||
      rawValue === 'rectangle' ||
      rawValue === 'diamond' ||
      rawValue === 'triangle' ||
      rawValue === 'circle'
    ) {
      return rawValue;
    }

    return 'pen';
  }

  private sanitizeWhiteboardText(rawValue: unknown): string {
    return typeof rawValue === 'string'
      ? rawValue.replace(/\s+$/g, '').slice(0, WHITEBOARD_MAX_TEXT_CHARS)
      : '';
  }

  private sanitizeWhiteboardTextFontFamily(
    rawValue: unknown,
  ): WhiteboardTextFontFamily {
    return WHITEBOARD_TEXT_FONT_FAMILY_OPTIONS.includes(
      rawValue as WhiteboardTextFontFamily,
    )
      ? (rawValue as WhiteboardTextFontFamily)
      : 'sans';
  }

  private sanitizeWhiteboardTextSize(rawValue: unknown): WhiteboardTextSize {
    return WHITEBOARD_TEXT_SIZE_OPTIONS.includes(rawValue as WhiteboardTextSize)
      ? (rawValue as WhiteboardTextSize)
      : 'm';
  }

  private sanitizeWhiteboardTextAlign(rawValue: unknown): WhiteboardTextAlign {
    return WHITEBOARD_TEXT_ALIGN_OPTIONS.includes(rawValue as WhiteboardTextAlign)
      ? (rawValue as WhiteboardTextAlign)
      : 'left';
  }

  private sanitizeWhiteboardFontPixelSize(rawValue: unknown): number {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.min(240, Math.max(8, Math.round(value)));
  }

  private sanitizeWhiteboardShapeEdge(rawValue: unknown): WhiteboardShapeEdge {
    return WHITEBOARD_SHAPE_EDGE_OPTIONS.includes(rawValue as WhiteboardShapeEdge)
      ? (rawValue as WhiteboardShapeEdge)
      : 'sharp';
  }

  private sanitizeWhiteboardRotation(rawValue: unknown): number {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      return 0;
    }

    const turn = Math.PI * 2;
    let normalized = value % turn;
    if (normalized > Math.PI) {
      normalized -= turn;
    } else if (normalized < -Math.PI) {
      normalized += turn;
    }

    return normalized;
  }

  private sanitizeWhiteboardTabId(rawValue: unknown): string {
    if (typeof rawValue !== 'string') {
      return '';
    }

    const tabId = rawValue.trim();
    return WHITEBOARD_TAB_ID_PATTERN.test(tabId) ? tabId : '';
  }

  private sanitizeWhiteboardColor(rawValue: unknown): string {
    if (typeof rawValue !== 'string') {
      return '#0f172a';
    }

    const nextColor = rawValue.trim();
    return WHITEBOARD_COLOR_PATTERN.test(nextColor)
      ? nextColor.toLowerCase()
      : '#0f172a';
  }

  private sanitizeWhiteboardFillColor(rawValue: unknown): string {
    if (typeof rawValue !== 'string') {
      return '';
    }

    const nextColor = rawValue.trim();
    return WHITEBOARD_COLOR_PATTERN.test(nextColor)
      ? nextColor.toLowerCase()
      : '';
  }

  private sanitizeWhiteboardSize(rawValue: unknown): number {
    const size = Number(rawValue);
    if (!Number.isFinite(size)) {
      return 4;
    }

    return Math.min(
      WHITEBOARD_MAX_BRUSH_SIZE,
      Math.max(WHITEBOARD_MIN_BRUSH_SIZE, Math.round(size)),
    );
  }

  private sanitizeWhiteboardStrokeId(rawValue: unknown): string {
    if (typeof rawValue !== 'string') {
      return '';
    }

    const strokeId = rawValue.trim();
    return WHITEBOARD_STROKE_ID_PATTERN.test(strokeId) ? strokeId : '';
  }

  private sanitizeWhiteboardTabTitle(rawValue: unknown): string {
    if (typeof rawValue !== 'string') {
      return '';
    }

    return rawValue
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
  }

  private sanitizeWhiteboardFileName(rawValue: unknown): string {
    if (typeof rawValue !== 'string') {
      return '';
    }

    return rawValue
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, WHITEBOARD_MAX_FILE_NAME_CHARS);
  }

  private sanitizeWhiteboardFileUrl(rawValue: unknown): string {
    if (typeof rawValue !== 'string') {
      return '';
    }

    const fileUrl = rawValue.trim().slice(0, WHITEBOARD_MAX_FILE_URL_CHARS);
    if (!fileUrl) {
      return '';
    }

    if (
      fileUrl.startsWith('http://') ||
      fileUrl.startsWith('https://') ||
      fileUrl.startsWith('/')
    ) {
      return fileUrl;
    }

    return '';
  }

  private sanitizeWhiteboardFileSize(rawValue: unknown): number {
    const fileSize = Number(rawValue);
    if (!Number.isFinite(fileSize) || fileSize < 0) {
      return 0;
    }

    return Math.min(fileSize, APP_LIMITS.lessonMediaBytes);
  }

  private sanitizeWhiteboardScrollRatio(rawValue: unknown): number {
    const scrollRatio = Number(rawValue);
    if (!Number.isFinite(scrollRatio)) {
      return 0;
    }

    return Math.min(1, Math.max(0, scrollRatio));
  }

  private sanitizeWhiteboardViewportLeftRatio(rawValue: unknown): number {
    const leftRatio = Number(rawValue);
    if (!Number.isFinite(leftRatio)) {
      return 0;
    }

    return Math.min(1, Math.max(0, leftRatio));
  }

  private sanitizeWhiteboardViewportVisibleWidthRatio(rawValue: unknown): number {
    const widthRatio = Number(rawValue);
    if (!Number.isFinite(widthRatio)) {
      return 0;
    }

    return Math.min(1, Math.max(0, widthRatio));
  }

  private sanitizeWhiteboardZoom(rawValue: unknown): number {
    const zoom = Number(rawValue);
    if (!Number.isFinite(zoom)) {
      return 1;
    }

    return Math.min(WHITEBOARD_MAX_ZOOM, Math.max(WHITEBOARD_MIN_ZOOM, zoom));
  }

  private sanitizeWhiteboardViewportBaseWidth(rawValue: unknown): number {
    const viewportBaseWidth = Number(rawValue);
    if (!Number.isFinite(viewportBaseWidth)) {
      return WHITEBOARD_MIN_VIEWPORT_BASE_WIDTH;
    }

    return Math.min(
      WHITEBOARD_MAX_VIEWPORT_BASE_WIDTH,
      Math.max(WHITEBOARD_MIN_VIEWPORT_BASE_WIDTH, Math.round(viewportBaseWidth)),
    );
  }

  private sanitizeWhiteboardViewportBaseHeight(rawValue: unknown): number {
    const viewportBaseHeight = Number(rawValue);
    if (!Number.isFinite(viewportBaseHeight)) {
      return WHITEBOARD_MIN_VIEWPORT_BASE_HEIGHT;
    }

    return Math.min(
      WHITEBOARD_MAX_VIEWPORT_BASE_HEIGHT,
      Math.max(WHITEBOARD_MIN_VIEWPORT_BASE_HEIGHT, Math.round(viewportBaseHeight)),
    );
  }

  private sanitizeWhiteboardPageNumber(rawValue: unknown): number {
    const pageNumber = Number(rawValue);
    if (!Number.isFinite(pageNumber)) {
      return 1;
    }

    return Math.min(5000, Math.max(1, Math.round(pageNumber)));
  }

  private sanitizeWhiteboardSelectedPages(rawValue: unknown): number[] {
    if (!Array.isArray(rawValue)) {
      return [];
    }

    return Array.from(
      new Set(
        rawValue
          .slice(0, WHITEBOARD_MAX_SELECTED_PAGES)
          .map((pageNumber) => this.sanitizeWhiteboardPageNumber(pageNumber))
          .filter((pageNumber) => Number.isFinite(pageNumber) && pageNumber > 0),
      ),
    ).sort((left, right) => left - right);
  }

  private sanitizeWhiteboardSelectedPagesMode(rawValue: unknown): 'all' | 'custom' {
    return rawValue === 'custom' ? 'custom' : 'all';
  }

  private trimWhiteboardStrokes(strokes: WhiteboardStroke[]): WhiteboardStroke[] {
    if (strokes.length <= WHITEBOARD_MAX_STROKES) {
      return strokes;
    }

    return strokes.slice(strokes.length - WHITEBOARD_MAX_STROKES);
  }

  private cloneWhiteboardPoint(point: WhiteboardPoint): WhiteboardPoint {
    return {
      x: point.x,
      y: point.y,
    };
  }

  private cloneWhiteboardStroke(stroke: WhiteboardStroke): WhiteboardStroke {
    return {
      ...stroke,
      points: stroke.points.map((point) => this.cloneWhiteboardPoint(point)),
    };
  }

  private cloneWhiteboardStrokes(strokes: WhiteboardStroke[]): WhiteboardStroke[] {
    return strokes.map((stroke) => this.cloneWhiteboardStroke(stroke));
  }

  private pushWhiteboardHistory(
    target: WhiteboardHistoryTarget,
    nextStrokes: WhiteboardStroke[],
  ) {
    target.undoStack.push(this.cloneWhiteboardStrokes(target.strokes));
    if (target.undoStack.length > WHITEBOARD_MAX_HISTORY_ENTRIES) {
      target.undoStack = target.undoStack.slice(
        target.undoStack.length - WHITEBOARD_MAX_HISTORY_ENTRIES,
      );
    }

    target.redoStack = [];
    target.strokes = nextStrokes;
  }

  private applyWhiteboardUndo(target: WhiteboardHistoryTarget): boolean {
    const previousStrokes = target.undoStack.pop();
    if (!previousStrokes) {
      return false;
    }

    target.redoStack.push(this.cloneWhiteboardStrokes(target.strokes));
    if (target.redoStack.length > WHITEBOARD_MAX_HISTORY_ENTRIES) {
      target.redoStack = target.redoStack.slice(
        target.redoStack.length - WHITEBOARD_MAX_HISTORY_ENTRIES,
      );
    }

    target.strokes = previousStrokes;
    return true;
  }

  private applyWhiteboardRedo(target: WhiteboardHistoryTarget): boolean {
    const nextStrokes = target.redoStack.pop();
    if (!nextStrokes) {
      return false;
    }

    target.undoStack.push(this.cloneWhiteboardStrokes(target.strokes));
    if (target.undoStack.length > WHITEBOARD_MAX_HISTORY_ENTRIES) {
      target.undoStack = target.undoStack.slice(
        target.undoStack.length - WHITEBOARD_MAX_HISTORY_ENTRIES,
      );
    }

    target.strokes = nextStrokes;
    return true;
  }

  private sanitizeWhiteboardTimestamp(rawValue: unknown): number {
    const timestamp = Number(rawValue);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return Date.now();
    }

    return Math.round(timestamp);
  }

  private upsertWhiteboardPdfLibraryItem(
    room: RoomInfo,
    item: WhiteboardPdfLibraryItem,
  ) {
    this.ensureWhiteboardState(room);
    const nextLibrary = room.whiteboard.pdfLibrary.filter(
      (entry) => entry.id !== item.id && entry.fileUrl !== item.fileUrl,
    );
    nextLibrary.push(item);
    room.whiteboard.pdfLibrary = nextLibrary
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, WHITEBOARD_MAX_LIBRARY_ITEMS);
  }

  private ensureWhiteboardState(room: RoomInfo): WhiteboardState {
    if (!Array.isArray(room.whiteboard.tabs) || room.whiteboard.tabs.length === 0) {
      room.whiteboard.tabs = [createWhiteboardBoardTab()];
    }

    const boardTab = room.whiteboard.tabs.find(
      (tab): tab is WhiteboardBoardTab => tab.type === 'board',
    );

    if (!boardTab) {
      room.whiteboard.tabs.unshift(createWhiteboardBoardTab());
    } else if (boardTab.id !== WHITEBOARD_BOARD_TAB_ID) {
      boardTab.id = WHITEBOARD_BOARD_TAB_ID;
      boardTab.zoom =
        typeof boardTab.zoom === 'number'
          ? this.sanitizeWhiteboardZoom(boardTab.zoom)
          : 1;
      boardTab.viewportBaseWidth =
        typeof boardTab.viewportBaseWidth === 'number'
          ? this.sanitizeWhiteboardViewportBaseWidth(boardTab.viewportBaseWidth)
          : WHITEBOARD_MIN_VIEWPORT_BASE_WIDTH;
      boardTab.viewportBaseHeight =
        typeof boardTab.viewportBaseHeight === 'number'
          ? this.sanitizeWhiteboardViewportBaseHeight(boardTab.viewportBaseHeight)
          : WHITEBOARD_MIN_VIEWPORT_BASE_HEIGHT;
      boardTab.undoStack = Array.isArray(boardTab.undoStack) ? boardTab.undoStack : [];
      boardTab.redoStack = Array.isArray(boardTab.redoStack) ? boardTab.redoStack : [];
    } else {
      boardTab.zoom =
        typeof boardTab.zoom === 'number'
          ? this.sanitizeWhiteboardZoom(boardTab.zoom)
          : 1;
      boardTab.viewportBaseWidth =
        typeof boardTab.viewportBaseWidth === 'number'
          ? this.sanitizeWhiteboardViewportBaseWidth(boardTab.viewportBaseWidth)
          : WHITEBOARD_MIN_VIEWPORT_BASE_WIDTH;
      boardTab.viewportBaseHeight =
        typeof boardTab.viewportBaseHeight === 'number'
          ? this.sanitizeWhiteboardViewportBaseHeight(boardTab.viewportBaseHeight)
          : WHITEBOARD_MIN_VIEWPORT_BASE_HEIGHT;
      boardTab.undoStack = Array.isArray(boardTab.undoStack) ? boardTab.undoStack : [];
      boardTab.redoStack = Array.isArray(boardTab.redoStack) ? boardTab.redoStack : [];
    }

    room.whiteboard.tabs.forEach((tab) => {
      if (tab.type !== 'pdf') {
        return;
      }

      tab.scrollRatio =
        typeof tab.scrollRatio === 'number'
          ? this.sanitizeWhiteboardScrollRatio(tab.scrollRatio)
          : 0;
      tab.zoom =
        typeof tab.zoom === 'number' ? this.sanitizeWhiteboardZoom(tab.zoom) : 1;
      tab.viewportPageNumber =
        typeof tab.viewportPageNumber === 'number'
          ? this.sanitizeWhiteboardPageNumber(tab.viewportPageNumber)
          : 1;
      tab.viewportPageOffsetRatio =
        typeof tab.viewportPageOffsetRatio === 'number'
          ? this.sanitizeWhiteboardScrollRatio(tab.viewportPageOffsetRatio)
          : 0;
      tab.viewportLeftRatio =
        typeof tab.viewportLeftRatio === 'number'
          ? this.sanitizeWhiteboardViewportLeftRatio(tab.viewportLeftRatio)
          : 0;
      tab.viewportVisibleHeightRatio =
        typeof tab.viewportVisibleHeightRatio === 'number'
          ? this.sanitizeWhiteboardScrollRatio(tab.viewportVisibleHeightRatio)
          : 0;
      tab.viewportVisibleWidthRatio =
        typeof tab.viewportVisibleWidthRatio === 'number'
          ? this.sanitizeWhiteboardViewportVisibleWidthRatio(
              tab.viewportVisibleWidthRatio,
            )
          : 0;
      tab.viewportBaseWidth =
        typeof tab.viewportBaseWidth === 'number'
          ? this.sanitizeWhiteboardViewportBaseWidth(tab.viewportBaseWidth)
          : WHITEBOARD_MIN_VIEWPORT_BASE_WIDTH;
      tab.selectedPages = this.sanitizeWhiteboardSelectedPages(tab.selectedPages);
      tab.selectedPagesMode =
        this.sanitizeWhiteboardSelectedPagesMode(
          (tab as WhiteboardPdfTab).selectedPagesMode,
        ) === 'custom' || tab.selectedPages.length > 0
          ? 'custom'
          : 'all';
      tab.pages = (Array.isArray(tab.pages) ? tab.pages : []).map((page) => ({
        ...page,
        undoStack: Array.isArray(page.undoStack) ? page.undoStack : [],
        redoStack: Array.isArray(page.redoStack) ? page.redoStack : [],
      }));
    });

    if (
      !room.whiteboard.activeTabId ||
      !room.whiteboard.tabs.some((tab) => tab.id === room.whiteboard.activeTabId)
    ) {
      room.whiteboard.activeTabId = WHITEBOARD_BOARD_TAB_ID;
    }

    if (!Array.isArray(room.whiteboard.pdfLibrary)) {
      room.whiteboard.pdfLibrary = [];
    }

    return room.whiteboard;
  }

  private getWhiteboardBoardTab(room: RoomInfo): WhiteboardBoardTab {
    this.ensureWhiteboardState(room);
    let boardTab = room.whiteboard.tabs.find(
      (tab): tab is WhiteboardBoardTab => tab.type === 'board',
    );

    if (!boardTab) {
      boardTab = createWhiteboardBoardTab();
      room.whiteboard.tabs.unshift(boardTab);
    }

    return boardTab;
  }

  private getWhiteboardTab(room: RoomInfo, rawTabId: unknown): WhiteboardTab | null {
    const tabId = this.sanitizeWhiteboardTabId(rawTabId) || WHITEBOARD_BOARD_TAB_ID;
    this.ensureWhiteboardState(room);

    return room.whiteboard.tabs.find((tab) => tab.id === tabId) || null;
  }

  private getWhiteboardPdfTab(room: RoomInfo, rawTabId: unknown): WhiteboardPdfTab | null {
    const tab = this.getWhiteboardTab(room, rawTabId);
    if (!tab || tab.type !== 'pdf') {
      return null;
    }

    return tab;
  }

  private getWhiteboardPdfPage(
    tab: WhiteboardPdfTab,
    rawPageNumber: unknown,
    createIfMissing = false,
  ): WhiteboardPdfPageState | null {
    const pageNumber = this.sanitizeWhiteboardPageNumber(rawPageNumber);
    let pageState =
      tab.pages.find((page) => page.pageNumber === pageNumber) || null;

    if (!pageState && createIfMissing) {
      pageState = {
        pageNumber,
        strokes: [],
        undoStack: [],
        redoStack: [],
      };
      tab.pages.push(pageState);
      if (tab.pages.length > WHITEBOARD_MAX_PAGE_STATES) {
        tab.pages = tab.pages
          .sort((a, b) => a.pageNumber - b.pageNumber)
          .slice(tab.pages.length - WHITEBOARD_MAX_PAGE_STATES);
      }
    }

    return pageState;
  }

  private getWhiteboardHistoryTarget(
    room: RoomInfo,
    rawTabId: unknown,
    rawPageNumber: unknown,
    createIfMissing = false,
  ): WhiteboardHistoryTarget | null {
    const tab =
      this.getWhiteboardTab(room, rawTabId) || this.getWhiteboardBoardTab(room);

    if (tab.type === 'board') {
      return tab;
    }

    return this.getWhiteboardPdfPage(tab, rawPageNumber, createIfMissing);
  }

  private isSocketInRoom(
    room: RoomInfo | undefined,
    socketId: string,
  ): boolean {
    return Boolean(room?.peers.has(socketId));
  }

  private getSocketUserId(client: Socket): string {
    return String(client.data?.user?._id || '');
  }

  private async getSocketPremiumStatus(client: Socket): Promise<string> {
    const userId = this.getSocketUserId(client);
    if (!userId) {
      return 'none';
    }

    try {
      return await this.premiumService.getPremiumStatus(userId);
    } catch {
      return 'none';
    }
  }

  private clearDisconnectTimer(room: RoomInfo, socketId: string) {
    const timer = room.disconnectTimers.get(socketId);
    if (timer) {
      clearTimeout(timer);
      room.disconnectTimers.delete(socketId);
    }
  }

  private resolveWhiteboardOwnerDisplayName(room: RoomInfo): string {
    if (room.whiteboard.ownerPeerId) {
      return room.peers.get(room.whiteboard.ownerPeerId) || 'Host';
    }

    if (room.whiteboard.ownerUserId) {
      const matchedPeerId = Array.from(room.peerUsers.entries()).find(
        ([, userId]) => userId === room.whiteboard.ownerUserId,
      )?.[0];

      if (matchedPeerId) {
        return room.peers.get(matchedPeerId) || 'Host';
      }
    }

    return 'Host';
  }

  private serializeWhiteboardTab(tab: WhiteboardTab): Record<string, unknown> {
    if (tab.type === 'board') {
      return {
        id: tab.id,
        type: tab.type,
        title: tab.title,
        zoom: tab.zoom,
        viewportBaseWidth: tab.viewportBaseWidth,
        viewportBaseHeight: tab.viewportBaseHeight,
        strokes: tab.strokes,
      };
    }

      return {
        id: tab.id,
        type: tab.type,
        title: tab.title,
        fileUrl: tab.fileUrl,
        fileName: tab.fileName,
        fileSize: tab.fileSize,
        scrollRatio: tab.scrollRatio,
        zoom: tab.zoom,
        viewportPageNumber: tab.viewportPageNumber,
        viewportPageOffsetRatio: tab.viewportPageOffsetRatio,
        viewportLeftRatio: tab.viewportLeftRatio,
        viewportVisibleHeightRatio: tab.viewportVisibleHeightRatio,
        viewportVisibleWidthRatio: tab.viewportVisibleWidthRatio,
        viewportBaseWidth: tab.viewportBaseWidth,
        selectedPagesMode: tab.selectedPagesMode,
        selectedPages: tab.selectedPages,
        pages: tab.pages.map((page) => ({
          pageNumber: page.pageNumber,
          strokes: page.strokes,
        })),
      };
  }

  private serializeWhiteboardPdfLibraryItem(
    item: WhiteboardPdfLibraryItem,
  ): Record<string, unknown> {
    return {
      id: item.id,
      title: item.title,
      fileUrl: item.fileUrl,
      fileName: item.fileName,
      fileSize: item.fileSize,
      createdAt: item.createdAt,
    };
  }

  private emitWhiteboardState(target: Socket | string, room: RoomInfo) {
    this.ensureWhiteboardState(room);
    const payload = {
      isActive: room.whiteboard.isActive,
      ownerPeerId: room.whiteboard.ownerPeerId,
      ownerDisplayName: this.resolveWhiteboardOwnerDisplayName(room),
      activeTabId: room.whiteboard.activeTabId,
      tabs: room.whiteboard.tabs.map((tab) => this.serializeWhiteboardTab(tab)),
      pdfLibrary: room.whiteboard.pdfLibrary.map((item) =>
        this.serializeWhiteboardPdfLibraryItem(item),
      ),
    };

    if (typeof target === 'string') {
      this.server.to(target).emit('whiteboard-state', payload);
      return;
    }

    target.emit('whiteboard-state', payload);
  }

  private emitWhiteboardStopped(roomId: string, room: RoomInfo) {
    this.server.to(roomId).emit('whiteboard-stopped', {
      ownerPeerId: room.whiteboard.ownerPeerId,
    });
  }

  private resetWhiteboard(roomId: string, room: RoomInfo, broadcast = true) {
    const previousOwnerPeerId = room.whiteboard.ownerPeerId;
    const shouldEmitStopped = room.whiteboard.isActive;
    room.whiteboard = createDefaultWhiteboardState();

    if (!broadcast) {
      return;
    }

    if (shouldEmitStopped) {
      this.server.to(roomId).emit('whiteboard-stopped', {
        ownerPeerId: previousOwnerPeerId,
      });
    }
    this.server.to(roomId).emit('whiteboard-cleared');
  }

  private removePeerFromRoom(room: RoomInfo, roomId: string, socketId: string) {
    this.clearDisconnectTimer(room, socketId);
    room.peers.delete(socketId);
    room.peerUsers.delete(socketId);
    if (room.creatorSocketId === socketId) {
      room.creatorSocketId = '';
      this.resetWhiteboard(roomId, room);
    }
    if (room.peers.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  private getSocketById(socketId: string): Socket | undefined {
    if (!socketId) {
      return undefined;
    }

    const serverSockets = this.server?.sockets;

    if (serverSockets instanceof Map) {
      return serverSockets.get(socketId);
    }

    if ('sockets' in serverSockets && serverSockets.sockets instanceof Map) {
      return serverSockets.sockets.get(socketId);
    }

    return undefined;
  }

  private replaceExistingPeerSocket(
    room: RoomInfo,
    roomId: string,
    userId: string,
    nextSocketId: string,
  ) {
    if (!userId) {
      return;
    }

    const existingSocketId = Array.from(room.peerUsers.entries()).find(
      ([socketId, knownUserId]) =>
        socketId !== nextSocketId && knownUserId === userId,
    )?.[0];

    if (!existingSocketId) {
      return;
    }

    this.clearDisconnectTimer(room, existingSocketId);
    room.peers.delete(existingSocketId);
    room.peerUsers.delete(existingSocketId);

    if (room.creatorSocketId === existingSocketId) {
      room.creatorSocketId = nextSocketId;
    }
    if (room.whiteboard.ownerUserId && room.whiteboard.ownerUserId === userId) {
      room.whiteboard.ownerPeerId = nextSocketId;
      room.whiteboard.updatedAt = Date.now();
    }

    const previousSocket = this.getSocketById(existingSocketId);
    previousSocket?.leave(roomId);
  }

  private findSharedRoomForPeers(
    sourceSocketId: string,
    targetSocketId: string,
  ): {
    roomId: string;
    room: RoomInfo;
  } | null {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.peers.has(sourceSocketId) && room.peers.has(targetSocketId)) {
        return { roomId, room };
      }
    }

    return null;
  }

  private canCreatorControlPeer(
    room: RoomInfo | undefined,
    creatorSocketId: string,
    targetPeerId: string,
  ): boolean {
    return Boolean(
      room &&
      room.creatorSocketId === creatorSocketId &&
      room.peers.has(targetPeerId),
    );
  }

  private canManageWhiteboard(
    room: RoomInfo | undefined,
    client: Socket,
  ): room is RoomInfo {
    if (
      !room ||
      room.creatorSocketId !== client.id ||
      !room.peers.has(client.id)
    ) {
      return false;
    }

    return true;
  }

  private getPeerKey(client: Socket): string {
    return String(client.data?.user?._id || client.id);
  }

  private isUserChatMember(chat: ChatDocument, userId: string): boolean {
    return chat.members.some((memberId) => String(memberId) === userId);
  }

  private async rehydratePrivateRoom(
    roomId: string,
    userId: string,
  ): Promise<RoomInfo | null> {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }

    const chat = await this.chatModel
      .findOne({
        videoCallRoomId: roomId,
        members: new Types.ObjectId(userId),
      })
      .select('name members videoCallCreatorId')
      .exec();

    if (
      !chat ||
      !chat.videoCallCreatorId ||
      !this.isUserChatMember(chat, userId)
    ) {
      return null;
    }

    const room: RoomInfo = {
      peers: new Map(),
      peerUsers: new Map(),
      isPrivate: true,
      title: this.sanitizeRoomTitle(chat.name) || 'Private meet',
      participantLimit: 2,
      creatorSocketId: '',
      creatorUserId: String(chat.videoCallCreatorId),
      knockQueue: new Map(),
      disconnectTimers: new Map(),
      whiteboard: createDefaultWhiteboardState(),
    };

    this.rooms.set(roomId, room);
    return room;
  }

  private notifyCreatorOfPendingKnocks(roomId: string, room: RoomInfo) {
    if (!room.creatorSocketId || room.knockQueue.size === 0) {
      return;
    }

    room.knockQueue.forEach((entry) => {
      this.server.to(room.creatorSocketId).emit('knock-request', {
        peerId: entry.peerKey,
        displayName: entry.displayName,
      });
    });
  }

  async handleConnection(client: Socket) {
    try {
      const payload = await verifySocketToken(
        this.jwtService,
        this.configService,
        client,
      );
      if (payload) {
        client.data.user = {
          _id: payload.sub,
          email: payload.email,
        };
      }
    } catch (err) {
      client.data.user = null;
      console.log(`[Video] auth error for ${client.id}:`, err.message);
    }
    console.log(`[Video] connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[Video] disconnected: ${client.id}`);
    this.rooms.forEach((room, roomId) => {
      if (room.peers.has(client.id)) {
        this.clearDisconnectTimer(room, client.id);
        const userId =
          room.peerUsers.get(client.id) || this.getSocketUserId(client);
        const timer = setTimeout(() => {
          const currentPeerUserId = room.peerUsers.get(client.id);
          if (
            !room.peers.has(client.id) ||
            (userId && currentPeerUserId && currentPeerUserId !== userId)
          ) {
            room.disconnectTimers.delete(client.id);
            return;
          }

          this.removePeerFromRoom(room, roomId, client.id);
          this.server.to(roomId).emit('peer-left', { peerId: client.id });
        }, DISCONNECT_GRACE_MS);

        room.disconnectTimers.set(client.id, timer);
      }
      const knockEntries = Array.from(room.knockQueue.entries());
      const matchingKnockEntry = knockEntries.find(
        ([, entry]) => entry.socket.id === client.id,
      );

      if (matchingKnockEntry) {
        room.knockQueue.delete(matchingKnockEntry[0]);
        if (room.creatorSocketId === client.id) {
          room.knockQueue.forEach((entry) => {
            this.server
              .to(entry.socket.id)
              .emit('knock-rejected', { reason: 'Creator left' });
          });
          room.knockQueue.clear();
        }
      }
    });
  }

  // ─── Room Management ────────────────────────────────────────────────────────

  @SubscribeMessage('create-room')
  async handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      displayName: string;
      isPrivate?: boolean;
      title?: string;
    },
  ) {
    this.rateLimiter.take(`video:create-room:${client.id}`, 5, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const displayName = this.sanitizeDisplayName(data?.displayName);
    const isPrivate = Boolean(data?.isPrivate);
    const title = this.sanitizeRoomTitle(data?.title);

    const userId = client.data?.user?._id;
    if (!userId) {
      client.emit('error', {
        message: 'Authentication required to create a room',
      });
      return;
    }

    if (!ROOM_ID_PATTERN.test(roomId)) {
      client.emit('error', { message: 'Room ID noto‘g‘ri' });
      return;
    }

    const existingRoom = this.rooms.get(roomId);
    if (existingRoom) {
      if (existingRoom.creatorUserId !== userId) {
        client.emit('error', {
          message: 'Bu room allaqachon mavjud. Yangisini yarating.',
        });
        return;
      }

      existingRoom.creatorSocketId = client.id;
      this.replaceExistingPeerSocket(
        existingRoom,
        roomId,
        String(userId),
        client.id,
      );
      this.admitPeer(client, roomId, displayName, existingRoom);
      client.emit('room-created', {
        roomId,
        isPrivate: existingRoom.isPrivate,
        title: existingRoom.title,
        reconnected: true,
      });
      client.emit('room-info', {
        title: existingRoom.title,
        isPrivate: existingRoom.isPrivate,
      });
      this.emitWhiteboardState(client, existingRoom);
      if (existingRoom.whiteboard.isActive) {
        this.emitWhiteboardState(roomId, existingRoom);
      }
      this.notifyCreatorOfPendingKnocks(roomId, existingRoom);
      return;
    }

    let activeRoomsCount = 0;
    this.rooms.forEach((room) => {
      if (room.creatorUserId === userId) {
        activeRoomsCount++;
      }
    });

    try {
      const status = await this.premiumService.getPremiumStatus(userId);

      if (activeRoomsCount >= 1) {
        client.emit('error', {
          message: 'Sizda allaqachon faol meet mavjud.',
        });
        return;
      }

      if (title.length > APP_TEXT_LIMITS.meetTitleChars) {
        client.emit('error', {
          message: `Meet nomi maksimal ${APP_TEXT_LIMITS.meetTitleChars} ta belgidan oshmasligi kerak`,
        });
        return;
      }

      const participantLimit = getTierLimit(
        APP_LIMITS.meetParticipants,
        status,
      );

      this.rooms.set(roomId, {
        peers: new Map([[client.id, displayName]]),
        peerUsers: new Map([[client.id, String(userId)]]),
        isPrivate,
        title,
        participantLimit,
        creatorSocketId: client.id,
        creatorUserId: userId,
        knockQueue: new Map(),
        disconnectTimers: new Map(),
        whiteboard: createDefaultWhiteboardState(),
      });

      client.join(roomId);
      client.emit('room-created', { roomId, isPrivate, title });
      console.log(
        `[Video] created room ${roomId} "${title}" (${isPrivate ? 'private' : 'open'}) by ${displayName}`,
      );
      return;
    } catch (err) {
      console.error('[Video] Premium check error:', err);
      client.emit('error', { message: 'Failed to check premium status' });
      return;
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; displayName: string },
  ) {
    this.rateLimiter.take(`video:join-room:${client.id}`, 15, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const displayName = this.sanitizeDisplayName(data?.displayName);
    const userId = String(client.data?.user?._id || '');
    let room: RoomInfo | null | undefined = this.rooms.get(roomId);
    const peerKey = this.getPeerKey(client);

    if (!room) {
      room = await this.rehydratePrivateRoom(roomId, userId);
      if (!room) {
        client.emit('error', { message: 'Room not found' });
        return;
      }
    }

    if (room.peers.has(client.id)) {
      client.emit('room-info', {
        title: room.title,
        isPrivate: room.isPrivate,
      });
      return;
    }

    this.replaceExistingPeerSocket(room, roomId, userId, client.id);

    if (room.peers.size >= room.participantLimit) {
      client.emit('error', {
        message: `Bu room uchun maksimal ${room.participantLimit} ta ishtirokchi ruxsat etilgan`,
      });
      return;
    }

    if (room.isPrivate) {
      if (room.knockQueue.has(peerKey)) {
        const existingEntry = room.knockQueue.get(peerKey);
        if (existingEntry) {
          existingEntry.socket = client;
          existingEntry.displayName = displayName;
        }
        client.emit('waiting-for-approval');
        client.emit('room-info', {
          title: room.title,
          isPrivate: room.isPrivate,
        });
        return;
      }

      room.knockQueue.set(peerKey, {
        peerKey,
        displayName,
        socket: client,
      });
      this.server.to(room.creatorSocketId).emit('knock-request', {
        peerId: peerKey,
        displayName,
      });
      client.emit('waiting-for-approval');
      // Send room info (title) to the waiting guest
      client.emit('room-info', {
        title: room.title,
        isPrivate: room.isPrivate,
      });
      return;
    }

    // Open room: join immediately
    this.admitPeer(client, roomId, displayName, room);
    // Send room info to newly joined peer
    client.emit('room-info', { title: room.title, isPrivate: room.isPrivate });
  }

  /** Internal: fully admit a peer into the room */
  private admitPeer(
    client: Socket,
    roomId: string,
    displayName: string,
    room: RoomInfo,
  ) {
    const existingPeers = Array.from(room.peers.entries()).map(
      ([id, name]) => ({
        peerId: id,
        displayName: name,
      }),
    );

    room.peers.set(client.id, displayName);
    room.peerUsers.set(client.id, this.getSocketUserId(client));
    this.clearDisconnectTimer(room, client.id);
    client.join(roomId);

    client.emit('existing-peers', { peers: existingPeers });
    this.emitWhiteboardState(client, room);
    client.to(roomId).emit('peer-joined', { peerId: client.id, displayName });
  }

  private emitRoomInfo(roomId: string, room: RoomInfo) {
    this.server.to(roomId).emit('room-info', {
      title: room.title,
      isPrivate: room.isPrivate,
    });
  }

  // ─── Approval Flow ──────────────────────────────────────────────────────────

  @SubscribeMessage('approve-knock')
  handleApproveKnock(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string },
  ) {
    this.rateLimiter.take(`video:approve-knock:${client.id}`, 30, 60_000);
    const { roomId, peerId } = data;
    const room = this.rooms.get(roomId);
    if (!room || room.creatorSocketId !== client.id) return;

    const entry = room.knockQueue.get(peerId);
    if (!entry) return;

    if (room.peers.size >= room.participantLimit) {
      this.server.to(entry.socket.id).emit('knock-rejected', {
        reason: 'Room to‘lib bo‘lgan',
      });
      room.knockQueue.delete(peerId);
      return;
    }

    room.knockQueue.delete(peerId);

    // Notify the guest they're approved. Mic/cam are allowed by default.
    this.server
      .to(entry.socket.id)
      .emit('knock-approved', {
        roomId,
        title: room.title,
        mediaLocked: false,
      });

    // Admit them using the stored socket reference
    this.admitPeer(entry.socket, roomId, entry.displayName, room);
  }

  @SubscribeMessage('reject-knock')
  handleRejectKnock(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string },
  ) {
    this.rateLimiter.take(`video:reject-knock:${client.id}`, 30, 60_000);
    const { roomId, peerId } = data;
    const room = this.rooms.get(roomId);
    if (!room || room.creatorSocketId !== client.id) return;

    const entry = room.knockQueue.get(peerId);
    if (!entry) return;

    room.knockQueue.delete(peerId);
    this.server
      .to(entry.socket.id)
      .emit('knock-rejected', { reason: 'Creator rad etdi' });
  }

  @SubscribeMessage('set-room-privacy')
  handleSetRoomPrivacy(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isPrivate: boolean },
  ) {
    this.rateLimiter.take(`video:set-room-privacy:${client.id}`, 30, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!room || room.creatorSocketId !== client.id) return;

    room.isPrivate = Boolean(data?.isPrivate);
    this.emitRoomInfo(roomId, room);

    if (!room.isPrivate && room.knockQueue.size > 0) {
      for (const [peerId, entry] of Array.from(room.knockQueue.entries())) {
        if (room.peers.size >= room.participantLimit) {
          this.server.to(entry.socket.id).emit('knock-rejected', {
            reason: 'Room to‘lib bo‘lgan',
          });
          room.knockQueue.delete(peerId);
          continue;
        }

        room.knockQueue.delete(peerId);
        this.server.to(entry.socket.id).emit('knock-approved', {
          roomId,
          title: room.title,
          mediaLocked: false,
        });
        this.admitPeer(entry.socket, roomId, entry.displayName, room);
        this.server.to(entry.socket.id).emit('room-info', {
          title: room.title,
          isPrivate: room.isPrivate,
        });
      }
    }
  }

  // ─── Whiteboard Relay ───────────────────────────────────────────────────────

  @SubscribeMessage('whiteboard-start')
  handleWhiteboardStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    this.rateLimiter.take(`video:whiteboard:start:${client.id}`, 120, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!this.canManageWhiteboard(room, client)) return;

    this.ensureWhiteboardState(room);
    room.whiteboard.isActive = true;
    room.whiteboard.ownerPeerId = client.id;
    room.whiteboard.ownerUserId = this.getSocketUserId(client);
    room.whiteboard.activeTabId =
      room.whiteboard.activeTabId || WHITEBOARD_BOARD_TAB_ID;
    room.whiteboard.updatedAt = Date.now();

    this.server.to(roomId).emit('whiteboard-started', {
      ownerPeerId: room.whiteboard.ownerPeerId,
      ownerDisplayName: this.resolveWhiteboardOwnerDisplayName(room),
      activeTabId: room.whiteboard.activeTabId,
    });
    this.emitWhiteboardState(roomId, room);
  }

  @SubscribeMessage('whiteboard-stop')
  handleWhiteboardStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    this.rateLimiter.take(`video:whiteboard:stop:${client.id}`, 120, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!this.canManageWhiteboard(room, client)) return;

    this.ensureWhiteboardState(room);
    room.whiteboard.isActive = false;
    room.whiteboard.ownerPeerId = client.id;
    room.whiteboard.ownerUserId = this.getSocketUserId(client);
    room.whiteboard.updatedAt = Date.now();

    this.server.to(roomId).emit('whiteboard-stopped', {
      ownerPeerId: room.whiteboard.ownerPeerId,
    });
    this.emitWhiteboardState(roomId, room);
  }

  @SubscribeMessage('whiteboard-clear')
  handleWhiteboardClear(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; tabId?: string; pageNumber?: number },
  ) {
    this.rateLimiter.take(`video:whiteboard:clear:${client.id}`, 120, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!this.canManageWhiteboard(room, client)) return;

    const tab =
      this.getWhiteboardTab(room, data?.tabId) || this.getWhiteboardBoardTab(room);
    if (tab.type === 'board') {
      if (tab.strokes.length === 0) {
        return;
      }
      this.pushWhiteboardHistory(tab, []);
    } else {
      const pageState = this.getWhiteboardPdfPage(tab, data?.pageNumber, false);
      if (!pageState || pageState.strokes.length === 0) {
        return;
      }
      this.pushWhiteboardHistory(pageState, []);
    }

    room.whiteboard.ownerPeerId = client.id;
    room.whiteboard.ownerUserId = this.getSocketUserId(client);
    room.whiteboard.updatedAt = Date.now();
    this.server.to(roomId).emit('whiteboard-cleared');
    this.emitWhiteboardState(roomId, room);
  }

  @SubscribeMessage('whiteboard-tab-activate')
  handleWhiteboardTabActivate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; tabId?: string },
  ) {
    this.rateLimiter.take(`video:whiteboard:tab-activate:${client.id}`, 600, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!this.canManageWhiteboard(room, client)) return;

    const tab = this.getWhiteboardTab(room, data?.tabId);
    if (!tab) {
      return;
    }

    room.whiteboard.isActive = true;
    room.whiteboard.activeTabId = tab.id;
    room.whiteboard.ownerPeerId = client.id;
    room.whiteboard.ownerUserId = this.getSocketUserId(client);
    room.whiteboard.updatedAt = Date.now();
    this.emitWhiteboardState(roomId, room);
  }

  @SubscribeMessage('whiteboard-pdf-add')
  async handleWhiteboardPdfAdd(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      tabId?: string;
      libraryItemId?: string;
      title?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      createdAt?: number;
      selectedPagesMode?: 'all' | 'custom';
      selectedPages?: number[];
    },
  ) {
    this.rateLimiter.take(`video:whiteboard:pdf-add:${client.id}`, 120, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!this.canManageWhiteboard(room, client)) return;

    const tabId = this.sanitizeWhiteboardTabId(data?.tabId);
    const libraryItemId = this.sanitizeWhiteboardTabId(data?.libraryItemId);
    const fileUrl = this.sanitizeWhiteboardFileUrl(data?.fileUrl);
    const fileName = this.sanitizeWhiteboardFileName(data?.fileName);
    const title =
      this.sanitizeWhiteboardTabTitle(data?.title) ||
      fileName.replace(/\.pdf$/i, '') ||
      'PDF';

    if (!tabId || !fileUrl || !fileName) {
      return;
    }

    this.ensureWhiteboardState(room);
    const premiumStatus = await this.getSocketPremiumStatus(client);
    const pdfTabLimit = getTierLimit(APP_LIMITS.whiteboardPdfTabs, premiumStatus);
    const nextTabs = room.whiteboard.tabs.filter((tab) => tab.id !== tabId);
    const pdfTabsCount = nextTabs.filter((tab) => tab.type === 'pdf').length;
    if (pdfTabsCount >= pdfTabLimit || pdfTabsCount >= WHITEBOARD_MAX_TABS - 1) {
      client.emit('error', {
        message: `Bu tarifda ${pdfTabLimit} ta PDF tab ochish mumkin`,
      });
      return;
    }

    const nextFileSize = this.sanitizeWhiteboardFileSize(data?.fileSize);
    const pdfLibraryBytesLimit = getTierLimit(
      APP_LIMITS.whiteboardPdfLibraryBytes,
      premiumStatus,
    );
    const nextLibraryItem: WhiteboardPdfLibraryItem = {
      id: libraryItemId || tabId,
      title,
      fileUrl,
      fileName,
      fileSize: nextFileSize,
      createdAt: this.sanitizeWhiteboardTimestamp(data?.createdAt),
    };
    const nextLibrary = room.whiteboard.pdfLibrary.filter(
      (entry) =>
        entry.id !== nextLibraryItem.id && entry.fileUrl !== nextLibraryItem.fileUrl,
    );
    nextLibrary.push(nextLibraryItem);
    if (getWhiteboardPdfLibraryBytes(nextLibrary) > pdfLibraryBytesLimit) {
      client.emit('error', {
        message: `PDF kutubxona limiti ${(pdfLibraryBytesLimit / (1024 * 1024)).toFixed(0)} MB`,
      });
      return;
    }

    const nextTab: WhiteboardPdfTab = {
      id: tabId,
      type: 'pdf',
      title,
      fileUrl,
      fileName,
      fileSize: nextFileSize,
      scrollRatio: 0,
      zoom: 1,
      viewportPageNumber: 1,
      viewportPageOffsetRatio: 0,
      viewportLeftRatio: 0,
      viewportVisibleHeightRatio: 0,
      viewportVisibleWidthRatio: 0,
      viewportBaseWidth: WHITEBOARD_MIN_VIEWPORT_BASE_WIDTH,
      selectedPages: this.sanitizeWhiteboardSelectedPages(data?.selectedPages),
      selectedPagesMode:
        this.sanitizeWhiteboardSelectedPagesMode(data?.selectedPagesMode) === 'custom' ||
        this.sanitizeWhiteboardSelectedPages(data?.selectedPages).length > 0
          ? 'custom'
          : 'all',
      pages: [],
    };

    this.upsertWhiteboardPdfLibraryItem(room, nextLibraryItem);
    room.whiteboard.tabs = [...nextTabs, nextTab];
    room.whiteboard.isActive = true;
    room.whiteboard.activeTabId = tabId;
    room.whiteboard.ownerPeerId = client.id;
    room.whiteboard.ownerUserId = this.getSocketUserId(client);
    room.whiteboard.updatedAt = Date.now();
    this.emitWhiteboardState(roomId, room);
  }

  @SubscribeMessage('whiteboard-pdf-library-add')
  async handleWhiteboardPdfLibraryAdd(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      itemId?: string;
      title?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      createdAt?: number;
    },
  ) {
    this.rateLimiter.take(`video:whiteboard:pdf-library-add:${client.id}`, 120, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!this.canManageWhiteboard(room, client)) return;

    const itemId = this.sanitizeWhiteboardTabId(data?.itemId);
    const fileUrl = this.sanitizeWhiteboardFileUrl(data?.fileUrl);
    const fileName = this.sanitizeWhiteboardFileName(data?.fileName);
    const title =
      this.sanitizeWhiteboardTabTitle(data?.title) ||
      fileName.replace(/\.pdf$/i, '') ||
      'PDF';

    if (!itemId || !fileUrl || !fileName) {
      return;
    }

    const premiumStatus = await this.getSocketPremiumStatus(client);
    const pdfLibraryBytesLimit = getTierLimit(
      APP_LIMITS.whiteboardPdfLibraryBytes,
      premiumStatus,
    );
    const nextItem: WhiteboardPdfLibraryItem = {
      id: itemId,
      title,
      fileUrl,
      fileName,
      fileSize: this.sanitizeWhiteboardFileSize(data?.fileSize),
      createdAt: this.sanitizeWhiteboardTimestamp(data?.createdAt),
    };
    const nextLibrary = room.whiteboard.pdfLibrary.filter(
      (entry) => entry.id !== nextItem.id && entry.fileUrl !== nextItem.fileUrl,
    );
    nextLibrary.push(nextItem);
    if (getWhiteboardPdfLibraryBytes(nextLibrary) > pdfLibraryBytesLimit) {
      client.emit('error', {
        message: `PDF kutubxona limiti ${(pdfLibraryBytesLimit / (1024 * 1024)).toFixed(0)} MB`,
      });
      return;
    }

    this.upsertWhiteboardPdfLibraryItem(room, nextItem);
    room.whiteboard.ownerPeerId = client.id;
    room.whiteboard.ownerUserId = this.getSocketUserId(client);
    room.whiteboard.updatedAt = Date.now();
    this.emitWhiteboardState(roomId, room);
  }

  @SubscribeMessage('whiteboard-tab-remove')
  handleWhiteboardTabRemove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; tabId?: string },
  ) {
    this.rateLimiter.take(`video:whiteboard:tab-remove:${client.id}`, 240, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!this.canManageWhiteboard(room, client)) return;

    const tabId = this.sanitizeWhiteboardTabId(data?.tabId);
    if (!tabId || tabId === WHITEBOARD_BOARD_TAB_ID) {
      return;
    }

    this.ensureWhiteboardState(room);
    const nextTabs = room.whiteboard.tabs.filter((tab) => tab.id !== tabId);
    if (nextTabs.length === room.whiteboard.tabs.length) {
      return;
    }

    room.whiteboard.tabs = nextTabs;
    room.whiteboard.activeTabId =
      room.whiteboard.activeTabId === tabId
        ? WHITEBOARD_BOARD_TAB_ID
        : room.whiteboard.activeTabId;
    room.whiteboard.ownerPeerId = client.id;
    room.whiteboard.ownerUserId = this.getSocketUserId(client);
    room.whiteboard.updatedAt = Date.now();
    this.emitWhiteboardState(roomId, room);
  }

  @SubscribeMessage('whiteboard-pdf-viewport')
  handleWhiteboardPdfViewport(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      tabId?: string;
      scrollRatio?: number;
      zoom?: number;
      viewportPageNumber?: number;
      viewportPageOffsetRatio?: number;
      viewportLeftRatio?: number;
      viewportVisibleHeightRatio?: number;
      viewportVisibleWidthRatio?: number;
      viewportBaseWidth?: number;
    },
  ) {
    this.rateLimiter.take(`video:whiteboard:pdf-viewport:${client.id}`, 1500, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!this.canManageWhiteboard(room, client) || !room.whiteboard.isActive) {
      return;
    }

    const tab = this.getWhiteboardPdfTab(room, data?.tabId);
    if (!tab) {
      return;
    }

    if (typeof data?.scrollRatio !== 'undefined') {
      tab.scrollRatio = this.sanitizeWhiteboardScrollRatio(data?.scrollRatio);
    }
    if (typeof data?.zoom !== 'undefined') {
      tab.zoom = this.sanitizeWhiteboardZoom(data?.zoom);
    }
    if (typeof data?.viewportPageNumber !== 'undefined') {
      tab.viewportPageNumber = this.sanitizeWhiteboardPageNumber(data?.viewportPageNumber);
    }
    if (typeof data?.viewportPageOffsetRatio !== 'undefined') {
      tab.viewportPageOffsetRatio = this.sanitizeWhiteboardScrollRatio(
        data?.viewportPageOffsetRatio,
      );
    }
    if (typeof data?.viewportLeftRatio !== 'undefined') {
      tab.viewportLeftRatio = this.sanitizeWhiteboardViewportLeftRatio(
        data?.viewportLeftRatio,
      );
    }
    if (typeof data?.viewportVisibleHeightRatio !== 'undefined') {
      tab.viewportVisibleHeightRatio = this.sanitizeWhiteboardScrollRatio(
        data?.viewportVisibleHeightRatio,
      );
    }
    if (typeof data?.viewportVisibleWidthRatio !== 'undefined') {
      tab.viewportVisibleWidthRatio =
        this.sanitizeWhiteboardViewportVisibleWidthRatio(
          data?.viewportVisibleWidthRatio,
        );
    }
    if (typeof data?.viewportBaseWidth !== 'undefined') {
      tab.viewportBaseWidth = this.sanitizeWhiteboardViewportBaseWidth(
        data?.viewportBaseWidth,
      );
    }
    room.whiteboard.activeTabId = tab.id;
    room.whiteboard.ownerPeerId = client.id;
    room.whiteboard.ownerUserId = this.getSocketUserId(client);
    room.whiteboard.updatedAt = Date.now();
    this.emitWhiteboardState(roomId, room);
  }

  @SubscribeMessage('whiteboard-board-zoom')
  handleWhiteboardBoardZoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      tabId?: string;
      zoom?: number;
      viewportBaseWidth?: number;
      viewportBaseHeight?: number;
    },
  ) {
    this.rateLimiter.take(`video:whiteboard:board-zoom:${client.id}`, 1500, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!this.canManageWhiteboard(room, client) || !room.whiteboard.isActive) {
      return;
    }

    const tab =
      this.getWhiteboardTab(room, data?.tabId) || this.getWhiteboardBoardTab(room);
    if (!tab || tab.type !== 'board') {
      return;
    }

    if (typeof data?.zoom !== 'undefined') {
      tab.zoom = this.sanitizeWhiteboardZoom(data?.zoom);
    }
    if (typeof data?.viewportBaseWidth !== 'undefined') {
      tab.viewportBaseWidth = this.sanitizeWhiteboardViewportBaseWidth(
        data?.viewportBaseWidth,
      );
    }
    if (typeof data?.viewportBaseHeight !== 'undefined') {
      tab.viewportBaseHeight = this.sanitizeWhiteboardViewportBaseHeight(
        data?.viewportBaseHeight,
      );
    }

    room.whiteboard.activeTabId = tab.id;
    room.whiteboard.ownerPeerId = client.id;
    room.whiteboard.ownerUserId = this.getSocketUserId(client);
    room.whiteboard.updatedAt = Date.now();
    this.emitWhiteboardState(roomId, room);
  }

  @SubscribeMessage('whiteboard-undo')
  handleWhiteboardUndo(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; tabId?: string; pageNumber?: number },
  ) {
    this.rateLimiter.take(`video:whiteboard:undo:${client.id}`, 240, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!this.canManageWhiteboard(room, client) || !room.whiteboard.isActive) {
      return;
    }

    const target = this.getWhiteboardHistoryTarget(
      room,
      data?.tabId,
      data?.pageNumber,
      false,
    );
    if (!target || !this.applyWhiteboardUndo(target)) {
      return;
    }

    const tab =
      this.getWhiteboardTab(room, data?.tabId) || this.getWhiteboardBoardTab(room);
    room.whiteboard.activeTabId = tab.id;
    room.whiteboard.ownerPeerId = client.id;
    room.whiteboard.ownerUserId = this.getSocketUserId(client);
    room.whiteboard.updatedAt = Date.now();
    this.emitWhiteboardState(roomId, room);
  }

  @SubscribeMessage('whiteboard-redo')
  handleWhiteboardRedo(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; tabId?: string; pageNumber?: number },
  ) {
    this.rateLimiter.take(`video:whiteboard:redo:${client.id}`, 240, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!this.canManageWhiteboard(room, client) || !room.whiteboard.isActive) {
      return;
    }

    const target = this.getWhiteboardHistoryTarget(
      room,
      data?.tabId,
      data?.pageNumber,
      false,
    );
    if (!target || !this.applyWhiteboardRedo(target)) {
      return;
    }

    const tab =
      this.getWhiteboardTab(room, data?.tabId) || this.getWhiteboardBoardTab(room);
    room.whiteboard.activeTabId = tab.id;
    room.whiteboard.ownerPeerId = client.id;
    room.whiteboard.ownerUserId = this.getSocketUserId(client);
    room.whiteboard.updatedAt = Date.now();
    this.emitWhiteboardState(roomId, room);
  }

  @SubscribeMessage('whiteboard-stroke-start')
  handleWhiteboardStrokeStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      tabId?: string;
      pageNumber?: number;
      strokeId: string;
      tool?: WhiteboardTool;
      color?: string;
      size?: number;
      point?: WhiteboardPoint;
      points?: WhiteboardPoint[];
      text?: string;
      fillColor?: string;
      fontFamily?: WhiteboardTextFontFamily;
      textSize?: WhiteboardTextSize;
      textAlign?: WhiteboardTextAlign;
      fontPixelSize?: number;
      edgeStyle?: WhiteboardShapeEdge;
      rotation?: number;
    },
  ) {
    this.rateLimiter.take(
      `video:whiteboard:stroke-start:${client.id}`,
      1200,
      60_000,
    );
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!this.canManageWhiteboard(room, client) || !room.whiteboard.isActive) {
      return;
    }

    const tab =
      this.getWhiteboardTab(room, data?.tabId) || this.getWhiteboardBoardTab(room);
    const strokeId = this.sanitizeWhiteboardStrokeId(data?.strokeId);
    const points = this.sanitizeWhiteboardPoints(
      Array.isArray(data?.points) && data.points.length > 0
        ? data.points
        : data?.point
          ? [data.point]
          : [],
      WHITEBOARD_MAX_POINTS_PER_STROKE,
    );
    if (!strokeId || points.length === 0) {
      return;
    }

    const stroke: WhiteboardStroke = {
      id: strokeId,
      tool: this.sanitizeWhiteboardTool(data?.tool),
      color: this.sanitizeWhiteboardColor(data?.color),
      size: this.sanitizeWhiteboardSize(data?.size),
      points,
      text: this.sanitizeWhiteboardText(data?.text),
      fillColor: this.sanitizeWhiteboardFillColor(data?.fillColor),
      fontFamily: this.sanitizeWhiteboardTextFontFamily(data?.fontFamily),
      textSize: this.sanitizeWhiteboardTextSize(data?.textSize),
      textAlign: this.sanitizeWhiteboardTextAlign(data?.textAlign),
      fontPixelSize: this.sanitizeWhiteboardFontPixelSize(data?.fontPixelSize),
      edgeStyle: this.sanitizeWhiteboardShapeEdge(data?.edgeStyle),
      rotation: this.sanitizeWhiteboardRotation(data?.rotation),
      createdAt: Date.now(),
    };

    room.whiteboard.ownerPeerId = client.id;
    room.whiteboard.ownerUserId = this.getSocketUserId(client);
    room.whiteboard.activeTabId = tab.id;
    room.whiteboard.updatedAt = Date.now();

    if (tab.type === 'board') {
      this.pushWhiteboardHistory(
        tab,
        this.trimWhiteboardStrokes(
          tab.strokes
            .filter((existingStroke) => existingStroke.id !== strokeId)
            .concat(stroke),
        ),
      );
    } else {
      const pageState = this.getWhiteboardPdfPage(tab, data?.pageNumber, true);
      if (!pageState) {
        return;
      }
      this.pushWhiteboardHistory(
        pageState,
        this.trimWhiteboardStrokes(
          pageState.strokes
            .filter((existingStroke) => existingStroke.id !== strokeId)
            .concat(stroke),
        ),
      );
    }

    client.to(roomId).emit('whiteboard-stroke-started', {
      tabId: tab.id,
      pageNumber:
        tab.type === 'pdf'
          ? this.sanitizeWhiteboardPageNumber(data?.pageNumber)
          : undefined,
      stroke,
    });
    this.emitWhiteboardState(roomId, room);
  }

  @SubscribeMessage('whiteboard-stroke-append')
  handleWhiteboardStrokeAppend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      tabId?: string;
      pageNumber?: number;
      strokeId: string;
      points?: WhiteboardPoint[];
    },
  ) {
    this.rateLimiter.take(
      `video:whiteboard:stroke-append:${client.id}`,
      6000,
      60_000,
    );
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!this.canManageWhiteboard(room, client) || !room.whiteboard.isActive) {
      return;
    }

    const tab =
      this.getWhiteboardTab(room, data?.tabId) || this.getWhiteboardBoardTab(room);
    const strokeId = this.sanitizeWhiteboardStrokeId(data?.strokeId);
    const points = this.sanitizeWhiteboardPoints(data?.points);
    if (!strokeId || points.length === 0) {
      return;
    }

    const pageNumber = this.sanitizeWhiteboardPageNumber(data?.pageNumber);
    const strokeSource =
      tab.type === 'board'
        ? tab.strokes
        : (this.getWhiteboardPdfPage(tab, pageNumber, false)?.strokes ?? []);
    const stroke = strokeSource.find((existingStroke) => existingStroke.id === strokeId);
    if (!stroke) {
      return;
    }

    const remainingPoints =
      WHITEBOARD_MAX_POINTS_PER_STROKE - stroke.points.length;
    if (remainingPoints <= 0) {
      return;
    }

    const acceptedPoints = points.slice(0, remainingPoints);
    if (acceptedPoints.length === 0) {
      return;
    }

    stroke.points.push(...acceptedPoints);
    room.whiteboard.ownerPeerId = client.id;
    room.whiteboard.ownerUserId = this.getSocketUserId(client);
    room.whiteboard.activeTabId = tab.id;
    room.whiteboard.updatedAt = Date.now();

    client.to(roomId).emit('whiteboard-stroke-appended', {
      tabId: tab.id,
      pageNumber: tab.type === 'pdf' ? pageNumber : undefined,
      strokeId,
      points: acceptedPoints,
    });
    this.emitWhiteboardState(roomId, room);
  }

  @SubscribeMessage('whiteboard-stroke-remove')
  handleWhiteboardStrokeRemove(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      tabId?: string;
      pageNumber?: number;
      strokeId: string;
    },
  ) {
    this.rateLimiter.take(`video:whiteboard:stroke-remove:${client.id}`, 3000, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!this.canManageWhiteboard(room, client) || !room.whiteboard.isActive) {
      return;
    }

    const tab =
      this.getWhiteboardTab(room, data?.tabId) || this.getWhiteboardBoardTab(room);
    const strokeId = this.sanitizeWhiteboardStrokeId(data?.strokeId);
    if (!strokeId) {
      return;
    }

    let nextStrokes: WhiteboardStroke[] = [];
    let previousLength = 0;

    if (tab.type === 'board') {
      previousLength = tab.strokes.length;
      nextStrokes = tab.strokes.filter(
        (existingStroke) => existingStroke.id !== strokeId,
      );
      if (nextStrokes.length === previousLength) {
        return;
      }
      this.pushWhiteboardHistory(tab, nextStrokes);
    } else {
      const pageState = this.getWhiteboardPdfPage(tab, data?.pageNumber, false);
      if (!pageState) {
        return;
      }
      previousLength = pageState.strokes.length;
      nextStrokes = pageState.strokes.filter(
        (existingStroke) => existingStroke.id !== strokeId,
      );
      if (nextStrokes.length === previousLength) {
        return;
      }
      this.pushWhiteboardHistory(pageState, nextStrokes);
    }

    room.whiteboard.ownerPeerId = client.id;
    room.whiteboard.ownerUserId = this.getSocketUserId(client);
    room.whiteboard.activeTabId = tab.id;
    room.whiteboard.updatedAt = Date.now();

    client.to(roomId).emit('whiteboard-stroke-removed', {
      tabId: tab.id,
      pageNumber:
        tab.type === 'pdf'
          ? this.sanitizeWhiteboardPageNumber(data?.pageNumber)
          : undefined,
      strokeId,
    });
    this.emitWhiteboardState(roomId, room);
  }

  @SubscribeMessage('whiteboard-stroke-update')
  handleWhiteboardStrokeUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      tabId?: string;
      pageNumber?: number;
      strokeId: string;
      point?: WhiteboardPoint;
      points?: WhiteboardPoint[];
      text?: string;
      color?: string;
      size?: number;
      fillColor?: string;
      fontFamily?: WhiteboardTextFontFamily;
      textSize?: WhiteboardTextSize;
      textAlign?: WhiteboardTextAlign;
      fontPixelSize?: number;
      edgeStyle?: WhiteboardShapeEdge;
      rotation?: number;
    },
  ) {
    this.rateLimiter.take(`video:whiteboard:stroke-update:${client.id}`, 2400, 60_000);
    const roomId = typeof data?.roomId === 'string' ? data.roomId.trim() : '';
    const room = this.rooms.get(roomId);
    if (!this.canManageWhiteboard(room, client) || !room.whiteboard.isActive) {
      return;
    }

    const tab =
      this.getWhiteboardTab(room, data?.tabId) || this.getWhiteboardBoardTab(room);
    const strokeId = this.sanitizeWhiteboardStrokeId(data?.strokeId);
    if (!strokeId) {
      return;
    }

    const point = this.sanitizeWhiteboardPoint(data?.point);
    const nextPoints =
      Array.isArray(data?.points) && data.points.length > 0
        ? this.sanitizeWhiteboardPoints(
            data.points,
            WHITEBOARD_MAX_POINTS_PER_STROKE,
          )
        : [];
    const nextText =
      typeof data?.text === 'string'
        ? this.sanitizeWhiteboardText(data?.text)
        : undefined;
    const nextColor =
      typeof data?.color === 'string'
        ? this.sanitizeWhiteboardColor(data?.color)
        : undefined;
    const nextSize =
      typeof data?.size === 'number'
        ? this.sanitizeWhiteboardSize(data?.size)
        : undefined;
    const nextFillColor =
      typeof data?.fillColor === 'string'
        ? this.sanitizeWhiteboardFillColor(data?.fillColor)
        : undefined;
    const nextFontFamily =
      typeof data?.fontFamily === 'string'
        ? this.sanitizeWhiteboardTextFontFamily(data?.fontFamily)
        : undefined;
    const nextTextSize =
      typeof data?.textSize === 'string'
        ? this.sanitizeWhiteboardTextSize(data?.textSize)
        : undefined;
    const nextTextAlign =
      typeof data?.textAlign === 'string'
        ? this.sanitizeWhiteboardTextAlign(data?.textAlign)
        : undefined;
    const nextFontPixelSize =
      typeof data?.fontPixelSize === 'number'
        ? this.sanitizeWhiteboardFontPixelSize(data?.fontPixelSize)
        : undefined;
    const nextEdgeStyle =
      typeof data?.edgeStyle === 'string'
        ? this.sanitizeWhiteboardShapeEdge(data?.edgeStyle)
        : undefined;
    const nextRotation =
      typeof data?.rotation === 'number'
        ? this.sanitizeWhiteboardRotation(data?.rotation)
        : undefined;

    const updateStroke = (stroke: WhiteboardStroke): WhiteboardStroke =>
      stroke.id !== strokeId
        ? stroke
        : {
            ...stroke,
            points:
              nextPoints.length > 0
                ? nextPoints
                : point
                  ? [point]
                  : stroke.points,
            text: typeof nextText === 'string' ? nextText : stroke.text,
            color: nextColor || stroke.color,
            size: typeof nextSize === 'number' ? nextSize : stroke.size,
            fillColor:
              typeof nextFillColor === 'string'
                ? nextFillColor
                : stroke.fillColor,
            fontFamily: nextFontFamily || stroke.fontFamily,
            textSize: nextTextSize || stroke.textSize,
            textAlign: nextTextAlign || stroke.textAlign,
            fontPixelSize:
              typeof nextFontPixelSize === 'number'
                ? nextFontPixelSize
                : stroke.fontPixelSize,
            edgeStyle: nextEdgeStyle || stroke.edgeStyle,
            rotation:
              typeof nextRotation === 'number' ? nextRotation : stroke.rotation,
          };

    let didUpdate = false;
    let pageNumber: number | undefined;

    if (tab.type === 'board') {
      const nextStrokes = tab.strokes.map((stroke) => {
        if (stroke.id === strokeId) {
          didUpdate = true;
        }
        return updateStroke(stroke);
      });
      if (!didUpdate) {
        return;
      }
      this.pushWhiteboardHistory(tab, nextStrokes);
    } else {
      pageNumber = this.sanitizeWhiteboardPageNumber(data?.pageNumber);
      const pageState = this.getWhiteboardPdfPage(tab, pageNumber, false);
      if (!pageState) {
        return;
      }

      const nextStrokes = pageState.strokes.map((stroke) => {
        if (stroke.id === strokeId) {
          didUpdate = true;
        }
        return updateStroke(stroke);
      });
      if (!didUpdate) {
        return;
      }
      this.pushWhiteboardHistory(pageState, nextStrokes);
    }

    room.whiteboard.ownerPeerId = client.id;
    room.whiteboard.ownerUserId = this.getSocketUserId(client);
    room.whiteboard.activeTabId = tab.id;
    room.whiteboard.updatedAt = Date.now();

    client.to(roomId).emit('whiteboard-stroke-updated', {
      tabId: tab.id,
      pageNumber: tab.type === 'pdf' ? pageNumber : undefined,
      strokeId,
      point,
      points: nextPoints.length > 0 ? nextPoints : undefined,
      text: nextText,
      color: nextColor,
      size: nextSize,
      fillColor: nextFillColor,
      fontFamily: nextFontFamily,
      textSize: nextTextSize,
      textAlign: nextTextAlign,
      fontPixelSize: nextFontPixelSize,
      edgeStyle: nextEdgeStyle,
      rotation: nextRotation,
    });
    this.emitWhiteboardState(roomId, room);
  }

  // ─── WebRTC Signaling ────────────────────────────────────────────────────────

  @SubscribeMessage('offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; sdp: any },
  ) {
    this.rateLimiter.take(`video:offer:${client.id}`, 600, 60_000);
    const targetId =
      typeof data?.targetId === 'string' ? data.targetId.trim() : '';
    if (!targetId || targetId === client.id) {
      return;
    }
    const sharedRoom = this.findSharedRoomForPeers(client.id, targetId);
    if (!sharedRoom) {
      return;
    }
    this.server
      .to(targetId)
      .emit('offer', { senderId: client.id, sdp: data.sdp });
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; sdp: any },
  ) {
    this.rateLimiter.take(`video:answer:${client.id}`, 600, 60_000);
    const targetId =
      typeof data?.targetId === 'string' ? data.targetId.trim() : '';
    if (!targetId || targetId === client.id) {
      return;
    }
    const sharedRoom = this.findSharedRoomForPeers(client.id, targetId);
    if (!sharedRoom) {
      return;
    }
    this.server
      .to(targetId)
      .emit('answer', { senderId: client.id, sdp: data.sdp });
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; candidate: any },
  ) {
    this.rateLimiter.take(`video:ice:${client.id}`, 4000, 60_000);
    const targetId =
      typeof data?.targetId === 'string' ? data.targetId.trim() : '';
    if (!targetId || targetId === client.id) {
      return;
    }
    const sharedRoom = this.findSharedRoomForPeers(client.id, targetId);
    if (!sharedRoom) {
      return;
    }
    this.server.to(targetId).emit('ice-candidate', {
      senderId: client.id,
      candidate: data.candidate,
    });
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    this.rateLimiter.take(`video:leave-room:${client.id}`, 30, 60_000);
    const { roomId } = data;
    const room = this.rooms.get(roomId);
    if (room?.peers.has(client.id) || room?.knockQueue.has(client.id)) {
      if (room.peers.has(client.id)) {
        this.removePeerFromRoom(room, roomId, client.id);
      }
      room.knockQueue.delete(client.id);
    } else {
      return;
    }
    client.to(roomId).emit('peer-left', { peerId: client.id });
    client.leave(roomId);
  }

  // ─── Screen Share Relay ─────────────────────────────────────────────────────

  @SubscribeMessage('screen-share-started')
  handleScreenShareStarted(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    this.rateLimiter.take(`video:screen:${client.id}`, 120, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.isSocketInRoom(room, client.id)) return;
    client.to(data.roomId).emit('screen-share-started', { peerId: client.id });
  }

  @SubscribeMessage('screen-offer')
  handleScreenOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; sdp: any },
  ) {
    this.rateLimiter.take(`video:screen-offer:${client.id}`, 600, 60_000);
    const targetId =
      typeof data?.targetId === 'string' ? data.targetId.trim() : '';
    if (!targetId || targetId === client.id) {
      return;
    }
    const sharedRoom = this.findSharedRoomForPeers(client.id, targetId);
    if (!sharedRoom) {
      return;
    }
    this.server.to(targetId).emit('screen-offer', {
      senderId: client.id,
      sdp: data.sdp,
    });
  }

  @SubscribeMessage('screen-answer')
  handleScreenAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; sdp: any },
  ) {
    this.rateLimiter.take(`video:screen-answer:${client.id}`, 600, 60_000);
    const targetId =
      typeof data?.targetId === 'string' ? data.targetId.trim() : '';
    if (!targetId || targetId === client.id) {
      return;
    }
    const sharedRoom = this.findSharedRoomForPeers(client.id, targetId);
    if (!sharedRoom) {
      return;
    }
    this.server.to(targetId).emit('screen-answer', {
      senderId: client.id,
      sdp: data.sdp,
    });
  }

  @SubscribeMessage('screen-ice-candidate')
  handleScreenIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; candidate: any },
  ) {
    this.rateLimiter.take(`video:screen-ice:${client.id}`, 4000, 60_000);
    const targetId =
      typeof data?.targetId === 'string' ? data.targetId.trim() : '';
    if (!targetId || targetId === client.id) {
      return;
    }
    const sharedRoom = this.findSharedRoomForPeers(client.id, targetId);
    if (!sharedRoom) {
      return;
    }
    this.server.to(targetId).emit('screen-ice-candidate', {
      senderId: client.id,
      candidate: data.candidate,
    });
  }

  @SubscribeMessage('screen-share-stopped')
  handleScreenShareStopped(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    this.rateLimiter.take(`video:screen:${client.id}`, 120, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.isSocketInRoom(room, client.id)) return;
    client.to(data.roomId).emit('screen-share-stopped', { peerId: client.id });
  }

  @SubscribeMessage('media-state-changed')
  handleMediaStateChanged(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      hasAudio?: boolean;
      hasVideo?: boolean;
      audioMuted?: boolean;
      videoMuted?: boolean;
    },
  ) {
    this.rateLimiter.take(`video:media-state:${client.id}`, 600, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.isSocketInRoom(room, client.id)) return;

    client.to(data.roomId).emit('media-state-changed', {
      peerId: client.id,
      hasAudio: typeof data?.hasAudio === 'boolean' ? data.hasAudio : undefined,
      hasVideo: typeof data?.hasVideo === 'boolean' ? data.hasVideo : undefined,
      audioMuted:
        typeof data?.audioMuted === 'boolean' ? data.audioMuted : undefined,
      videoMuted:
        typeof data?.videoMuted === 'boolean' ? data.videoMuted : undefined,
    });
  }

  // ─── Recording Relay ────────────────────────────────────────────────────────

  @SubscribeMessage('recording-started')
  handleRecordingStarted(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    this.rateLimiter.take(`video:recording:${client.id}`, 60, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.isSocketInRoom(room, client.id)) return;
    client.to(data.roomId).emit('recording-started', { peerId: client.id });
  }

  @SubscribeMessage('recording-stopped')
  handleRecordingStopped(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    this.rateLimiter.take(`video:recording:${client.id}`, 60, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.isSocketInRoom(room, client.id)) return;
    client.to(data.roomId).emit('recording-stopped', { peerId: client.id });
  }

  // ─── Creator Media Controls ─────────────────────────────────────────────────

  @SubscribeMessage('force-mute-mic')
  handleForceMuteMic(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string },
  ) {
    this.rateLimiter.take(`video:creator-controls:${client.id}`, 120, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.canCreatorControlPeer(room, client.id, data.peerId)) return;
    this.server.to(data.peerId).emit('force-mute-mic');
  }

  @SubscribeMessage('force-mute-cam')
  handleForceMuteCam(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string },
  ) {
    this.rateLimiter.take(`video:creator-controls:${client.id}`, 120, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.canCreatorControlPeer(room, client.id, data.peerId)) return;
    this.server.to(data.peerId).emit('force-mute-cam');
  }

  @SubscribeMessage('allow-mic')
  handleAllowMic(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string },
  ) {
    this.rateLimiter.take(`video:creator-controls:${client.id}`, 120, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.canCreatorControlPeer(room, client.id, data.peerId)) return;
    this.server.to(data.peerId).emit('allow-mic');
  }

  @SubscribeMessage('allow-cam')
  handleAllowCam(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string },
  ) {
    this.rateLimiter.take(`video:creator-controls:${client.id}`, 120, 60_000);
    const room = this.rooms.get(data.roomId);
    if (!this.canCreatorControlPeer(room, client.id, data.peerId)) return;
    this.server.to(data.peerId).emit('allow-cam');
  }

  // ─── Hand Raise ─────────────────────────────────────────────────────────────

  @SubscribeMessage('hand-raised')
  handleHandRaised(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const room = this.rooms.get(data.roomId);
    if (!this.isSocketInRoom(room, client.id)) return;
    client.to(data.roomId).emit('hand-raised', { peerId: client.id });
  }

  @SubscribeMessage('hand-lowered')
  handleHandLowered(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const room = this.rooms.get(data.roomId);
    if (!this.isSocketInRoom(room, client.id)) return;
    client.to(data.roomId).emit('hand-lowered', { peerId: client.id });
  }

  // ─── Kick Peer ──────────────────────────────────────────────────────────────

  @SubscribeMessage('kick-peer')
  handleKickPeer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string },
  ) {
    const room = this.rooms.get(data.roomId);
    if (
      !room ||
      room.creatorSocketId !== client.id ||
      !room.peers.has(data.peerId)
    )
      return;
    // Notify the kicked peer
    this.server.to(data.peerId).emit('kicked');
    // Notify others
    client.to(data.roomId).emit('peer-left', { peerId: data.peerId });
    // Remove from room
    this.removePeerFromRoom(room, data.roomId, data.peerId);
    // Force leave the socket from the room
    const kickedSocket = this.getSocketById(data.peerId);
    if (kickedSocket) kickedSocket.leave(data.roomId);
  }
}
