import {
  Options,
  Sequelize,
  SyncOptions as SequelizeSyncOptions,
} from 'sequelize';
import glob from 'glob';
import Table, { MergeOptions, TableOptions } from './table';
import { Model, ModelCtor } from './model';
import { requireModule } from './utils';
import _ from 'lodash';

export interface SyncOptions extends SequelizeSyncOptions {

  /**
   * 指定需要更新字段的 tables
   */
  tables?: string[] | Table[] | Map<string, Table>;
}

export interface ImportOptions {

  /**
   * 指定配置所在路径
   */
  directory: string;

  /**
   * 文件后缀，默认值 ['js', 'ts', 'json']
   */
  extensions?: string[];
}

export interface DatabaseOptions extends Options {
}

export type HookType = 'beforeTableInit' | 'afterTableInit' | 'beforeAddField' | 'afterAddField';

export class Extend {
  tableOptions: TableOptions;
  mergeOptions: MergeOptions
  constructor(tableOptions: TableOptions, mergeOptions?: MergeOptions) {
    this.tableOptions = tableOptions;
    this.mergeOptions = mergeOptions;
  }
}

export function extend(tableOptions: TableOptions, mergeOptions: MergeOptions = {}) {
  return new Extend(tableOptions, mergeOptions);
}

export default class Database {

  public readonly sequelize: Sequelize;

  /**
   * 哪些 Model 需要建立表关系
   */
  public readonly associating = new Set<string>();

  /**
   * 中间表
   */
  public readonly throughTables = new Map<string, Array<string>>();

  protected tables = new Map<string, Table>();

  protected options: DatabaseOptions;

  protected hooks = {};

  protected extTableOptions = new Map<string, any>();

  constructor(options: DatabaseOptions) {
    this.options = options;
    this.sequelize = new Sequelize(options);
  }

  /**
   * 载入指定目录下 tables 配置（配置的文件驱动）
   * 
   * TODO: 配置的文件驱动现在会全部初始化，大数据时可能存在性能瓶颈，后续可以加入动态加载
   * 
   * @param {object}   [options]
   * @param {string}   [options.directory] 指定配置所在路径
   * @param {array}    [options.extensions = ['js', 'ts', 'json']] 文件后缀
   */
  public import(options: ImportOptions): Map<string, Table> {
    const { extensions = ['js', 'ts', 'json'], directory } = options;
    const patten = `${directory}/*.{${extensions.join(',')}}`;
    const files = glob.sync(patten, {
      ignore: [
        '**/*.d.ts'
      ]
    });
    const tables = new Map<string, Table>();
    files.forEach((file: string) => {
      const result = requireModule(file);
      if (result instanceof Extend) {
        // 如果还没初始化，extend 的先暂存起来，后续处理
        if (!this.tables.has(result.tableOptions.name)) {
          this.extTableOptions.set(result.tableOptions.name, result);
        } else {
          const table = this.extend(result.tableOptions, result.mergeOptions);
          tables.set(table.getName(), table);
        }
      } else {
        let table = this.extend(typeof result === 'function' ? result(this) : result);
        // 如果有未处理的 extend 取回来合并
        if (this.extTableOptions.has(table.getName())) {
          const result = this.extTableOptions.get(table.getName());
          table = this.extend(result.tableOptions, result.mergeOptions);
          this.extTableOptions.delete(table.getName());
        }
        tables.set(table.getName(), table);
      }
    });
    return tables;
  }

  /**
   * 配置表
   *
   * @param options 
   */
  public table(options: TableOptions): Table {
    const { name } = options;
    const table = new Table(options, { database: this });
    this.tables.set(name, table);
    // 在 source 或 target 之后定义 through，需要更新 source 和 target 的 model
    if (this.throughTables.has(name)) {
      const [sourceTable, targetTable] = this.getTables(this.throughTables.get(name));
      sourceTable && sourceTable.modelInit(true);
      targetTable && targetTable.modelInit(true);
      // this.throughTables.delete(name);
    }
    return table;
  }

  /**
   * 扩展配置（实验性 API）
   * 
   * @param options 
   */
  public extend(options: TableOptions, mergeOptions?: MergeOptions): Table {
    const { name } = options;
    let table: Table;
    if (this.tables.has(name)) {
      table = this.tables.get(name);
      table.extend(options, mergeOptions);
    } else {
      table = this.table(options);
      this.tables.set(name, table);
    }
    return table;
  }

  /**
   * 是否已配置
   * 
   * @param name 
   */
  public isDefined(name: string): boolean {
    return this.sequelize.isDefined(name);
  }

  /**
   * 获取 Model
   * 
   * TODO: 动态初始化并加载配置（懒汉式）
   * 动态初始化需要支持文件驱动和数据库驱动
   *
   * @param name 
   */
  public getModel(name: string): ModelCtor<Model> {
    return this.isDefined(name) ? this.sequelize.model(name) as any : undefined;
  }

  /**
   * 获取指定 names 的 Models
   *
   * @param names 
   */
  public getModels(names: string[] = []): Array<ModelCtor<Model>> {
    if (names.length === 0) {
      return this.sequelize.models as any;
    }
    return names.map(name => this.getModel(name));
  }

  /**
   * 获取 table 配置
   * 
   * TODO:
   * 未单独配置多对多中间表时，取不到中间表的 table，但是可以取到 Model
   * 动态初始化并加载配置（懒汉式），动态初始化需要支持文件驱动和数据库驱动
   * 
   * @param name 
   */
  public getTable(name: string): Table {
    return this.tables.has(name) ? this.tables.get(name) : undefined;
  }

  /**
   * 获取指定 names 的 table 配置
   *
   * @param names 
   */
  public getTables(names: string[] = []): Array<Table> {
    if (names.length === 0) {
      return [...this.tables.values()];
    }
    return names.map(name => this.getTable(name));
  }

  /**
   * 建立表关系
   * 
   * 表关系相关字段是在 Model.init 之后进行的
   */
  public associate() {
    for (const name of this.associating) {
      const Model: any = this.getModel(name);
      Model.associate && Model.associate(this.sequelize.models);
    }
  }

  /**
   * 插件扩展
   * 
   * TODO: 细节待定
   *
   * @param plugin 
   * @param options 
   */
  public async plugin(plugin: any, options = {}) {
    await plugin(this, options);
  }

  /**
   * 表字段更新
   * 
   * @param options 
   */
  public async sync(options: SyncOptions = {}) {
    const { tables = [], ...restOptions } = options;
    let items: Array<any>;

    if (tables instanceof Map) {
      items = Array.from(tables.values());
    } else {
      items = tables;
    }

    /**
     * sequelize.sync 只能处理全部 model 的字段更新
     * Model.sync 只能处理当前 Model 的字段更新，不处理关系表
     * database.sync 可以指定 tables 进行字段更新，也可以自动处理关系表的字段更新
     */
    if (items.length > 0) {
      // 指定 tables 时，新建 sequelize 实例来单独处理这些 tables 相关 models 的 sync
      const sequelize = new Sequelize(this.options);
      const names = new Set<string>();
      for (const key in items) {
        let table = items[key];
        if (typeof table === 'string') {
          table = this.getTable(table);
        }
        if (table instanceof Table) {
          for (const name of table.getRelatedTableNames()) {
            names.add(name);
          }
        }
      }
      for (const name of names) {
        // @ts-ignore
        const model = this.getModel(name);
        if (model) {
          sequelize.modelManager.addModel(model);
        }
      }
      await sequelize.sync(restOptions);
      await sequelize.close();
    } else {
      await this.sequelize.sync(restOptions);
    }
  }

  /**
   * 关闭数据库连接
   */
  public async close() {
    return this.sequelize.close();
  }

  /**
   * 添加 hook
   * 
   * @param hookType 
   * @param fn 
   */
  public addHook(hookType: HookType | string, fn: Function) {
    const hooks = this.hooks[hookType] || [];
    hooks.push(fn);
    this.hooks[hookType] = hooks;
  }

  /**
   * 运行 hook
   *
   * @param hookType 
   * @param args 
   */
  public async runHooks(hookType: HookType | string, ...args) {
    const hooks = this.hooks[hookType] || [];
    for (const hook of hooks) {
      if (typeof hook === 'function') {
        await hook(...args);
      }
    }
  }

  public getFieldByPath(fieldPath: string) {
    const [tableName, fieldName] = fieldPath.split('.');
    return this.getTable(tableName).getField(fieldName);
  }
}
