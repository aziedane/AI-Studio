import { 
  collection, 
  setDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { Trend, ContentPiece } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

export const firebaseService = {
  async login() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return signInWithPopup(auth, provider);
  },

  async logout() {
    return signOut(auth);
  },

  syncTrends(userId: string, callback: (trends: Trend[]) => void) {
    const q = query(
      collection(db, 'trends'), 
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data() } as Trend));
      callback(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trends');
    });
  },

  syncContentItems(userId: string, callback: (items: ContentPiece[]) => void) {
    const q = query(
      collection(db, 'contentItems'), 
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data() } as ContentPiece));
      callback(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'contentItems');
    });
  },

  async saveTrend(trend: Trend, userId: string) {
    try {
      const sanitized = this.sanitizeData({ ...trend, userId });
      await setDoc(doc(db, 'trends', trend.id), sanitized);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `trends/${trend.id}`);
    }
  },

  async saveTrendsBatch(trends: Trend[], userId: string) {
    try {
      const batch = writeBatch(db);
      trends.forEach(trend => {
        const ref = doc(db, 'trends', trend.id);
        const sanitized = this.sanitizeData({ ...trend, userId });
        batch.set(ref, sanitized);
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'trends_batch');
    }
  },

  async saveContentItem(item: ContentPiece, userId: string) {
    try {
      const sanitized = this.sanitizeData({ ...item, userId });
      await setDoc(doc(db, 'contentItems', item.id), sanitized);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `contentItems/${item.id}`);
    }
  },

  async updateContentItem(id: string, updates: Partial<ContentPiece>) {
    try {
      const sanitized = this.sanitizeData(updates);
      await updateDoc(doc(db, 'contentItems', id), sanitized);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `contentItems/${id}`);
    }
  },

  async deleteContentItem(id: string) {
    try {
      await deleteDoc(doc(db, 'contentItems', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `contentItems/${id}`);
    }
  },

  sanitizeData(data: any): any {
    if (data === undefined) return null;
    if (data === null) return null;
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }
    if (typeof data === 'object') {
      const sanitized: any = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          const value = data[key];
          if (value !== undefined) {
            sanitized[key] = this.sanitizeData(value);
          }
        }
      }
      return sanitized;
    }
    return data;
  }
};
