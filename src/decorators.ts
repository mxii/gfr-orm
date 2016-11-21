
import { Utils } from './utils';

export interface ColumnOptions {
   primary_key?: boolean;
   auto_inc?: boolean;
   [key: string]: any; // just to prevent ts-err-msg ! TS7017
}

export interface ColumnDecorator {
   colName?: string;
   options?: ColumnOptions;
}

export interface OrmObjectOptions {
   col?: string;
   options?: ColumnOptions;
}

export interface OrmColumns {
   [prop: string]: OrmObjectOptions;
}

export interface OrmObject extends Object {
   COLUMNS?: OrmColumns;
   TABLE?: string;
}

// PROP DECORATOR
export function Column(colName?: string | ColumnOptions, options?: ColumnOptions) {
   return function (target: OrmObject, propertyName: string) {

      if (!target.COLUMNS) {
         target.COLUMNS = {};
      }

      if (!colName || typeof colName === 'string') {
         target.COLUMNS[propertyName] = { col: <string>colName, options: options || {} };
      }
      else {
         target.COLUMNS[propertyName] = { col: undefined, options: <ColumnOptions>colName };
      }
   }
}

function setColumnOption(target: OrmObject, name: string, option: string, val: any) {
   if (!target.COLUMNS) {
      target.COLUMNS = {};
   }

   if (!target.COLUMNS[name]) {
      target.COLUMNS[name] = {};
   }

   if (!target.COLUMNS[name].options) {
      target.COLUMNS[name].options = {};
   }

   target.COLUMNS[name].options[option] = val;
}

// PROP DECORATOR
export function PrimaryKey() {
   return function (target: OrmObject, propertyName: string) {
      setColumnOption(target, propertyName, 'primary_key', true);
   };
}

// PROP DECORATOR
export function AutoInc() {
   return function (target: OrmObject, propertyName: string) {
      setColumnOption(target, propertyName, 'auto_inc', true);
   };
}

// CLASS DECORATOR
export function Table(name?: string) {
   return function (target: any) {
      target.prototype.TABLE = name || target.name;
   };
}

export interface IOrmBaseModel {
   new (model?: any): OrmBaseModel;
}

const _detectDate = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;

//correctly parse dates from local storage
const _dateReviver = (key: string, value: any) => {
   if (typeof value === 'string' && (_detectDate.test(value))) {
      return new Date(value);
   }
   return value;
}

export abstract class OrmBaseModel {

   protected _original: any;

   public abstract isValid(): boolean;

   public static Test() {
      const proto: OrmObject = Utils.getPrototype(this);
      return proto.TABLE;
   }

   protected _getPrefix(prefix: string): string {
      return prefix + (prefix && prefix[prefix.length - 1] === '/' ? '' : '/');
   }

   public createGetUrlVariables(prefix?: string): string {
      const primKeys = this.getPrimaryKeysAndValues();
      let urlVars = this._getPrefix(prefix);

      for (var key in primKeys) {
         urlVars += ':' + key + '/';
      }

      return urlVars;
   }

   public createGetUrl(prefix?: string): string {
      const primKeys = this.getPrimaryKeysAndValues();
      let urlVars = this._getPrefix(prefix);

      for (var key in primKeys) {
         urlVars += primKeys[key] + '/';
      }

      return urlVars;
   }

   public getTableName(): string {
      const proto: OrmObject = Utils.getPrototype(this);
      return proto.TABLE;
   }

   public getClassName(): string {
      return this.constructor.name;
   }

   protected _getProperty(prop: string): any {

   }

   protected _getColumnName(cols: OrmColumns, col: string): string {
      if (!cols || !col) return undefined;
      return cols[col].col || col;
   }

   public getColumnNames(): string[] {
      const proto: OrmObject = Utils.getPrototype(this);
      if (!proto || !proto.COLUMNS) return [];

      const columnNames = new Array<string>();
      const cols = proto.COLUMNS;
      Object.keys(cols).forEach(c => columnNames.push(this._getColumnName(cols, c)));

      return columnNames;
   }

   public getPrimaryKeysAndValues(useOriginalValues?: boolean, useStringValues?: boolean): any {
      const prims: any = {};
      const proto: OrmObject = Utils.getPrototype(this);
      if (!proto || !proto.COLUMNS) return false;

      const cols = proto.COLUMNS;
      for (var prop in cols) {
         if (cols.hasOwnProperty(prop)) {
            if (cols[prop].options && cols[prop].options.primary_key) {
               let colName = this._getColumnName(cols, prop);
               if (useOriginalValues === true) {
                  prims[colName] = useStringValues ? this.getStringValue(this._original[prop]) : this._original[prop];
               }
               else {
                  prims[colName] = useStringValues ? this.getStringValue((<any>this)[prop]) : (<any>this)[prop];
               }
            }
         }
      }

      return prims;
   }

   public hasChanged(): boolean {
      if (!this._original) return false;

      const proto: OrmObject = Utils.getPrototype(this);
      if (!proto || !proto.COLUMNS) return false;

      const cols = proto.COLUMNS;
      for (var prop in cols) {
         if (cols.hasOwnProperty(prop)) {
            //if ((<any>this)[prop] != this._original[prop]) {
            if (this.getStringValue((<any>this)[prop]) != this.getStringValue(this._original[prop])) {
               return true;
            }
         }
      }

      return false;
   }

   public getChanges(): { [prop: string]: any } {
      const changes: any = {};

      if (!this._original) return changes;

      const proto: OrmObject = Utils.getPrototype(this);
      if (!proto || !proto.COLUMNS) return changes;

      const cols = proto.COLUMNS;
      for (var prop in cols) {
         if (cols.hasOwnProperty(prop)) {
            if (this.getStringValue((<any>this)[prop]) != this.getStringValue(this._original[prop])) {
               changes[prop] = {
                  cur: this.getStringValue((<any>this)[prop]),
                  old: this.getStringValue(this._original[prop])
               };
            }
         }
      }

      return changes;
   }

   protected _import(model: any, target: any): void {
      const proto: OrmObject = Utils.getPrototype(this);
      if (!proto || !proto.COLUMNS) return console.log('mh?');

      const cols = proto.COLUMNS;
      for (var prop in cols) {
         const col = cols[prop];
         if (cols.hasOwnProperty(prop)) {
            target[prop] = _dateReviver(prop, model.hasOwnProperty(col.col) ? model[col.col] : model[prop]);
         }
      }
   }

   public import(model: OrmBaseModel) {
      if (!model) return;
      this.importCurrent(model);
      if (model._original) this.importOriginal(model._original);
   }

   public importCurrent(model: any) {
      this._import(model, this);
   }

   public importOriginal(model: any) {
      if (!this._original) {
         this._original = {};
      }
      this._import(model, this._original);
   }

   protected getStringValue(obj: any): string {
      if (obj instanceof Date) {
         return (<Date>obj).toISOString();
      }
      return typeof obj.toString === 'function' ? obj.toString().trim() : obj;
   }

   public export(withAutoInc?: boolean): any {
      const proto: OrmObject = Utils.getPrototype(this);
      if (!proto || !proto.COLUMNS) return;

      const obj: any = {};
      const cols = proto.COLUMNS;
      for (var prop in cols) {
         if (!cols[prop].options.auto_inc || withAutoInc === true) {
            obj[prop] = (<any>this)[prop] && this.getStringValue((<any>this)[prop]); // use EVERYTIME string values ..
         }
      }

      return obj;
   }

}