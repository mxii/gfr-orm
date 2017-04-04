
import { Utils } from './utils';

export interface ColumnOptions {
   primary_key?: boolean;
   auto_inc?: boolean;
   type?: string;
   default?: any;
   ignore?: boolean;
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

      const curOptions = target.COLUMNS[propertyName] ? target.COLUMNS[propertyName].options : {};

      if (!colName || typeof colName === 'string') {
         target.COLUMNS[propertyName] = { col: <string>colName, options: Object.assign({}, curOptions, options) };
      }
      else {
         target.COLUMNS[propertyName] = { col: undefined, options: Object.assign({}, curOptions, <ColumnOptions>colName) };
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

// PROP DECORATOR
// Date ist ein geschützer begriff =/
// export function Date() {
//    return function (target: OrmObject, propertyName: string) {
//       setColumnOption(target, propertyName, 'type', 'date');
//    };
// }

// PROP DECORATOR
export function Ignore() {
   return function (target: OrmObject, propertyName: string) {
      setColumnOption(target, propertyName, 'ignore', true);
   };
}

// PROP DECORATOR
export function Type(type: string) {
   return function (target: OrmObject, propertyName: string) {
      setColumnOption(target, propertyName, 'type', (type + '').toLowerCase());
   };
}

// PROP DECORATOR
export function Default(defaultValue: any) {
   return function (target: OrmObject, propertyName: string) {
      setColumnOption(target, propertyName, 'default', defaultValue);
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
      Object
         .keys(cols)
         .filter(c => !cols[c].options.ignore)
         .forEach(c => columnNames.push(this._getColumnName(cols, c)));

      return columnNames.filter(cn => !!cn);
   }

   private _checkTypeAndModifyValue(options: ColumnOptions, val: any): any {
      if (!options || !options.type || typeof options.type !== 'string') return val;

      if (options.type === 'date') {
         if (val instanceof Date) {
            // METHOD 1
            const offsetInHours = new Date().getTimezoneOffset() / 60;
            val.setHours(offsetInHours * -1);
            val.setMinutes(0);
            val.setSeconds(0);
            val.setMilliseconds(0);

            // METHOD 2 --> untested !! --> geht nicht?!?
            //val = new Date(val.getFullYear(), val.getMonth(), val.getDate());
         }
         else if (typeof val === 'string' && val === '0000-00-00') {
            val = null;
         }
      }
      else if (options.type === 'json' && typeof val === 'string') {
         try {
            const parsed = JSON.parse(val);
            val = parsed;
         } catch (error) {

         }
      }
      else if (options.type === 'number') {
         val = +val;
      }
      else if (options.type === 'boolean') {
         let bool = !!val;
         if (/*val instanceof Buffer &&*/ val.length === 1) {
            bool = !!val[0];
         }
         val = bool;
      }

      return val;
   }

   public getPrimaryKeysAndValues(useOriginalValues: boolean = false, useStringValues?: boolean, useOnlyAutoInc?: boolean): any {
      const prims: any = {};
      const proto: OrmObject = Utils.getPrototype(this);
      if (!proto || !proto.COLUMNS) return false;

      const cols = proto.COLUMNS;
      for (var prop in cols) {
         if (cols.hasOwnProperty(prop)) {
            if (cols[prop].options && cols[prop].options.primary_key && (!useOnlyAutoInc || cols[prop].options.auto_inc)) {
               let colName = this._getColumnName(cols, prop);
               let val: any;

               if (useOriginalValues === true) {
                  val = this._original[prop];
               }
               else {
                  val = (<any>this)[prop];
               }

               val = this._checkTypeAndModifyValue(cols[prop].options, val);

               prims[colName] = useStringValues ? this.getStringValue(val) : val;
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
         if (cols.hasOwnProperty(prop) && !cols[prop].options.ignore) {
            //if ((<any>this)[prop] != this._original[prop]) {
            let curVal = (<any>this)[prop];
            let oriVal = this._original[prop];

            curVal = this._checkTypeAndModifyValue(cols[prop].options, curVal);
            oriVal = this._checkTypeAndModifyValue(cols[prop].options, oriVal);

            if (this.getStringValue(curVal) != this.getStringValue(oriVal)) {
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
         if (cols.hasOwnProperty(prop) && !cols[prop].options.ignore) {
            let curVal = (<any>this)[prop];
            let oriVal = this._original[prop];

            curVal = this._checkTypeAndModifyValue(cols[prop].options, curVal);
            oriVal = this._checkTypeAndModifyValue(cols[prop].options, oriVal);

            if (this.getStringValue(curVal) != this.getStringValue(oriVal)) {
               changes[prop] = {
                  cur: this.getStringValue(curVal),
                  old: this.getStringValue(oriVal)
               };
            }
         }
      }

      return changes;
   }

   protected _import(model: any, target: any, ignoreCase = false): void {
      const proto: OrmObject = Utils.getPrototype(this);
      if (!proto || !proto.COLUMNS) return console.log('mh?');

      const cols = proto.COLUMNS;
      Object.keys(cols).forEach(prop => {
         const col = cols[prop];
         let rawValue: any;
         let modelPropertyName = col.col;

         if (!model.hasOwnProperty(modelPropertyName)) {
            modelPropertyName = prop;
            if (!model.hasOwnProperty(modelPropertyName)) {

               if (!ignoreCase) return;

               const foundModelKey = Object.keys(model).find(mk => mk.toLowerCase() == prop.toLowerCase());
               if (!foundModelKey) return;
               modelPropertyName = foundModelKey;
            }
         }

         //let val = _dateReviver(prop, model.hasOwnProperty(col.col) ? model[col.col] : model[prop]);
         let val = _dateReviver(prop, model[modelPropertyName]);
         val = this._checkTypeAndModifyValue(cols[prop].options, val);
         target[prop] = val;
      });

      // for (var prop in cols) {
      //    const col = cols[prop];
      //    if (cols.hasOwnProperty(prop)) {
      //       let val = _dateReviver(prop, model.hasOwnProperty(col.col) ? model[col.col] : model[prop]);

      //       val = this._checkTypeAndModifyValue(cols[prop].options, val);

      //       target[prop] = val;
      //    }
      // }
   }

   public import(model: OrmBaseModel, ignoreCase = false) {
      if (!model) return;
      this.importCurrent(model, ignoreCase);
      if (model._original) this.importOriginal(model._original, ignoreCase);
   }

   public importCurrent(model: any, ignoreCase = false) {
      this._import(model, this, ignoreCase);
   }

   public importOriginal(model: any, ignoreCase = false) {
      if (!this._original) {
         this._original = {};
      }
      this._import(model, this._original, ignoreCase);
   }

   protected getStringValue(obj: any): string {
      if (obj === undefined || obj === null) return obj + '';
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
         if (!cols[prop].options.ignore && (!cols[prop].options.auto_inc || withAutoInc === true)) {
            let val = (<any>this)[prop];
            val = this._checkTypeAndModifyValue(cols[prop].options, val);
            obj[prop] = val && this.getStringValue(val); // use EVERYTIME string values ..
         }
      }

      return obj;
   }

   public generateWhereObject(columnNames: string[]) {
      const proto: OrmObject = Utils.getPrototype(this);
      if (!proto || !proto.COLUMNS) return {};

      const cols = proto.COLUMNS;
      const propNames = Object.keys(cols);
      const whereObj = {};

      columnNames.forEach(wProp => {
         const colName: string = propNames.find(p => p.toLowerCase() == wProp.toLowerCase());
         if (!colName) {
            console.log(wProp, colName, 'not found');
            return;
         }
         if (!cols[colName].options) {
            console.log(wProp, colName, 'no options');
            return;
         }
         if (cols[colName].options.ignore) {
            console.log(wProp, colName, 'ignore!');
            return;
         }

         whereObj[colName] = this._checkTypeAndModifyValue(cols[colName].options, this[colName]);
      });

      return whereObj;
   }

}