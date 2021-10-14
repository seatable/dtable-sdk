# dtable-sdk
dtable-sdk 是一个获取 seatable 中 base 数据的函数库, 通过接口函数向外提供服务，可用于插件开发, 第三方自定义开发，及其他应用的开发。

## 文档

## 开发实例

### 创建项目
基于 create-react-app 脚手架创建 dtable-sdk-demo 项目

`npx create-react-app dtable-sdk-demo`

### 安装依赖
在项目 dtable-sdk-demo 中安装 dtable-sdk 函数库

`npm install dtable-sdk --save`

### 创建测试数据
1. 登录 https://dev.seatable.cn/ 网站(如无账号, 请注册账号后, 再登录)
2. 点击 添加表格按钮, 创建 base "dtable-sdk"
3. 选中 base "dtable-sdk", 右侧有一个 "更多" 图标
4. 点击 "更多", 选中 "高级", 选中 "API token" 并点击
5. 在打开的 API token 对话框中, 创建 API token
6. 需要再次访问 API token 时, 执行 3, 4 两步可打开 API token 对话框, 查看已经创建的 API token 列表

注: 可以打开 base "dtable-sdk", 在内部执行创建子表, 创建视图, 添加行数据, 添加列数据等操作, 丰富测试数据

### 配置参数
1. 在 dtable-sdk-demo 项目 src 目录下创建 settings.js 文件
2. 更新 settings.js 配置文件, 内容如下

```
export default {
  "server": "https://dev.seatable.cn",                       // 访问 base 所在的 域名
  "APIToken": "50c17897ae8b1c7c428d459fc2c379a9bc3806cc",    // 基于 base 创建的 api token
  "workspaceID": "7",                                        // 当前 base 所在的 workspace 的 ID 值 
  "dtableName": "dtable-sdk",                                // 当前 base 的名称
  "lang": "zh-cn"                                            // 应用使用的语言(国际化方案请参见参考模版)
}

注: workspaceID 的值获取方式: 打开base 在 URL 中如 "https://dev.seatable.cn/workspace/7/dtable/dtable-sdk/?tid=0000&vid=0000", workspace 后面的 "7" 即为 当前 base 所在的 workspace 的 ID 值
```

### 基于 dtable-sdk 提供的接口函数进行开发

1. 更新 app.js 中的内容

```
import React from 'react';

class App extends React.Component {

  render() {
    return (
      <div>abc</div>
    );
  }
}

export default App;
```

2. 在 app.js 文件中 引入 settings.js 文件
`import config from './settings';`

3. 引入 dtable-sdk 提供的 DTable 接口对象

`import DTable from 'dtable-sdk';`

4. 创建 DTable 对象实例

```
import React from 'react';
import DTable from 'dtable-sdk';
import config from './settings';

class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {

    };

    // 创建实例
    this.dtable = new DTable();
  }

  render() {
    return (
      <div>abc</div>
    );
  }
}

export default App;
```

5. 初始化 DTable 配置参数, 建立与 base 的链接

```
import React from 'react';
import DTable from 'dtable-sdk';
import config from './settings';

class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {

    };
    // 创建 dtable 实例
    this.dtable = new DTable();
  }

  async componentDidMount() {
    // 初始化 dtable 的配置参数
    await this.dtable.init(config);

    // 与 base 建立链接
    await this.dtable.syncWithServer();
  }

  render() {
    return (
      <div>abc</div>
    );
  }
}

export default App;

```

6. 通过 dtable 提供的api, 获取 base 中的数据, 如 所有的子表, 子表的所有视图, 子表的所有列信息

```
import React from 'react';
import DTable from 'dtable-sdk';
import config from './settings';

import './App.css';

class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      tables: []
    };
    // 创建 dtable 实例
    this.dtable = new DTable();
  }

  async componentDidMount() {
    // 初始化 dtable 的配置参数
    await this.dtable.init(config);

    // 与 base 建立链接
    await this.dtable.syncWithServer();

    // 获取 base 中的数据
    const activeTable = this.dtable.getActiveTable();
    const views = this.dtable.getViews(activeTable);
    const columns = this.dtable.getColumns(activeTable);

    this.setState({
      tables: tables,
      views: views,
      columns: columns
    });
  }

  render() {

    if (this.state.tables.length === 0) {
      return (
        <div></div>
      );
    }

    const { tables, views, columns } = this.state;

    return (
      <div className="container">
        <div className="info-item">
          <div className="title">Table names:</div>
          {tables.map(table => {
            return <div>{table.name}</div>;
          })}
        </div>
        <div className="info-item">
          <div className="title">Active table's view names:</div>
          {views.map(view => {
            return <div>{view.name}</div>;
          })}
        </div>
        <div className="info-item">
          <div className="title">Active table's column Names:</div>
          {columns.map(column => {
            return <div>Column name: {column.name} -- Column type: {column.type}</div>;
          })}
        </div>
      </div>
    );
  }
}

export default App;

```

### 运行测试

执行 `npm start`, 可以在打开的页面中看到 base 中 子表的信息, 子表中视图的信息, 子表中列的信息

其他 dtable-sdk api 使用, 可以参照文档进行相关测试和使用

## 参考模板

[插件开发模板](https://github.com/seatable/seatable-plugin-template)
