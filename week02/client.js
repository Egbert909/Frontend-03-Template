const net = require("net");

class Request {
    constructor(options) {
        this.method = options.method || "GET";
        this.host = options.host;
        this.port = options.port || 80;
        this.path = options.path || "/";
        this.body = options.body || {};
        this.headers = options.headers || {};
        if (!this.headers["Content-Type"]) {
            this.headers["Content-Type"] = "application/x-www-form-urlencoded";
        }
        //根据Content-Type类型不同，处理body方式也不同，body传入是对象，encodeURIComponenth会对url连接符号等特殊符号进行16进制编码
        if (this.headers["Content-Type"] === "application/json") { //JSON数据格式
            this.bodyText = JSON.stringify(this.body);
        } else if (this.headers["Content-Type"] === "application/x-www-form-urlencoded") { //表单默认的提交数据的格式
            //把对象的参数转换成 a=xxx&b=yyy格式
            this.bodyText = Object.keys(this.body).map(key => `${key}=${encodeURIComponent(this.body[key])}`).join("&");
        }

        this.headers["Content-Length"] = this.bodyText.length;
    }
    /**
     * 发送HTTP请求
     * @param {} connection 
     */
    send(connection) {
        return new Promise((resolve, reject) => {
            if (connection) {
                connection.write(this.toString());
            } else {
                connection = net.createConnection({
                    host: this.host,
                    port: this.port
                }, () => {
                    console.log('before write')
                    console.log(this.toString());
                    connection.write(this.toString());
                })
            }
            const parser = new ResponseParser;
            connection.on('data', (data) => {
                console.log(data.toString());
/**
week02/client.js:38
HTTP/1.1 200 OK
Content-Type: text/html
Date: Mon, 10 Aug 2020 15:09:42 GMT
Connection: keep-alive
Transfer-Encoding: chunked

34
Hello name=egbert&age=111&url=http%3A%2F%2Fbaidu.com
0
 */
                parser.receive(data.toString());
                if (parser.isFinished) {
                    resolve(parser.response);
                    connection.end();
                }
            });
            connection.on('error', (err) => {
                reject(err);
                connection.end();
            });
        });
    }
    /**字符串转化连接 */
    toString() {
        // 构建目标把其中换行回车，空行替换成字符串中特殊符号\r回车\n换行

        // HTTP/1.1 200 OK
        // Content-Type: text/html
        // Date: Mon, 10 Aug 2020 15:17:35 GMT
        // Connection: keep-alive
        // Transfer-Encoding: chunked
        
        // 34
        // Hello name=egbert&age=111&url=http%3A%2F%2Fbaidu.com
        // 0
              
        let stream = [
            `${this.method} ${this.path} HTTP/1.1\r\n`,
            ...Object.keys(this.headers).map(key => `${key}: ${this.headers[key]}\r\n`),
            `\r\n`,
            `${this.bodyText}\r\n`
        ]
        return stream.join('');
    }
}
/**
 * 构建responsePaser
 */
class ResponseParser {
    constructor() {
        this.WAITING_STATUS_LINE = 0;//构建 status line 状态 （HTTP/1.1 200 OK）
        this.WAITING_STATUS_LINE_END = 1;//构建 status line 完成状态
        this.WAITING_HEADER_NAME = 2;//
        this.WAITING_HEADER_SPACE = 3;
        this.WAITING_HEADER_VALUE = 4;
        this.WAITING_HEADER_LINE_END = 5;
        this.WAITING_HEADER_BLOCK_END = 6;
        this.WAITING_BODY = 7;

        this.current = this.WAITING_STATUS_LINE;
        this.statusLine = "";
        this.headers = {};
        this.headerName = "";
        this.headerValue = "";
        this.bodyParser = null;
    }
    get isFinished() {
        return this.bodyParser && this.bodyParser.isFinished;
    }
    get response() {
        this.statusLine.match(/HTTP\/1.1 (\d+) (\S+)/);
        return {
            statusCode: RegExp.$1,
            statusText: RegExp.$2,
            headers: this.headers,
            body: this.bodyParser.content.join('')
        }
    }
    //状态机原理，编译成bodyParser
    receive(stringInput) {
        for (let i = 0; i < stringInput.length; i++) {
            this.receiveChar(stringInput.charAt(i));
        }
    }
    receiveChar(char) {
        if (this.current === this.WAITING_STATUS_LINE) {//构建STATUS_LINE行
            if (char === '\r') {//识别到第一个回车符代表构建STATUS_LINE结束
                this.current = this.WAITING_STATUS_LINE_END;//当前状态置为STATUS_LINE_END
            } else {//未识别到回车之前，把属于STATUS_LINE的字符保存到变量
                this.statusLine += char;
            }
        } else if (this.current === this.WAITING_STATUS_LINE_END) {
            if (char === '\n') {//识别到第一个换行，构造headname开始。（Content-Type）
                this.current = this.WAITING_HEADER_NAME;
            }
        } else if (this.current === this.WAITING_HEADER_NAME) {
            if (char === ':') {//识别到冒号，构建headname技术，构建冒号后空格开始
                this.current = this.WAITING_HEADER_SPACE;
            } else if (char === '\r') {//多次返回构建head对象完成后，会有一个空行，识别到空行的回车符，则head构建完毕，置为HEADER_BLOCK_END状态
                this.current = this.WAITING_HEADER_BLOCK_END;
                if (this.headers['Transfer-Encoding'] === 'chunked') {//此处默认Transfer-Encoding为chunked模式，构建bodyParser
                    this.bodyParser = new TrunkedBodyParser();//创建bodyParser
                }
            } else {//构建到headname冒号之前，属于headname的字符保存到对应变量
                this.headerName += char;
            }
        } else if (this.current === this.WAITING_HEADER_SPACE) {//构建headname冒号后的空格开始
            if (char === ' ') {//识别到空格，状态置为开始构建headvalue(text/html)
                this.current = this.WAITING_HEADER_VALUE;
            }
        } else if (this.current === this.WAITING_HEADER_VALUE) {//构建headvalue开始
            if (char === '\r') {//识别到换行符，构建headvalue结束，组装成headers变量，并置空headerName，headerValue
                this.headers[this.headerName] = this.headerValue;
                this.headerName = "";
                this.headerValue = "";
                this.current = this.WAITING_HEADER_LINE_END;//构建HEADER_LINE结束
            } else {//识别到换行之前，对应字符存进headvalue变量
                this.headerValue += char;
            }
        } else if (this.current === this.WAITING_HEADER_LINE_END) {//HEADER_LINE包括Content-Type，Date，Connection，Transfer-Encoding等多行，返回状态headername继续构建
            if (char === '\n') {
                this.current = this.WAITING_HEADER_NAME;
            }
        } else if (this.current === this.WAITING_HEADER_BLOCK_END) {
            if (char === '\n') {//识别到head外城后的换行符，则到等待body完成状态
                this.current = this.WAITING_BODY;
            }
        } else if (this.current === this.WAITING_BODY) {
            this.bodyParser.receiveChar(char);//调用bodyParser编译body部分
        }
    }
}
/**
 * chunke模式编译body部分，状态机
 */
class TrunkedBodyParser {
//body部分结构如下，由16进制数字开始，16进制0结束
// 34
// Hello name=egbert&age=111&url=http%3A%2F%2Fbaidu.com
// 0
    constructor() {
        this.WAITING_LENGTH = 0;
        this.WAITING_LENGTH_LINE_END = 1;
        this.READING_TRUNK = 2;
        this.WAITING_NEW_LINE = 3;
        this.WAITING_NEW_LINE_END = 4;
        this.length = 0;
        this.content = [];
        this.isFinished = false;
        this.current = this.WAITING_LENGTH;//从WAITING_LENGTH状态开始
    }

    receiveChar(char) {
        if (this.current === this.WAITING_LENGTH) {
            if (char === '\r') {
                this.current = this.WAITING_LENGTH_LINE_END;
                if (this.length === 0) {
                    this.isFinished = true;
                }
            } else {
                this.length *= 16;
                this.length += parseInt(char, 16);
            }
        } else if (this.current === this.WAITING_LENGTH_LINE_END) {
            if (char === '\n') {
                this.current = this.READING_TRUNK;
            }
        } else if (this.current === this.READING_TRUNK) {
            if (this.length !== 0) {
                this.content.push(char);
            }
            if (this.content.length === this.length) {
                this.current = this.WAITING_NEW_LINE;
                this.length = 0;
            }
        } else if (this.current === this.WAITING_NEW_LINE) {
            if (char === '\r') {
                this.current = this.WAITING_NEW_LINE_END;
            }
        } else if (this.current === this.WAITING_NEW_LINE_END) {
            if (char === '\n') {
                this.current = this.WAITING_LENGTH;
            }
        }
    }
}
/**
 * 执行顺序1
 */
void async function () {
    let request = new Request({
        //request相关参数
        method: "POST",
        host: "127.0.0.1",
        port: "8080",
        path: "/",
        headers: {
            ["X-Foo2"]: "customed"
        },
        body: {
            name: "egbert",
            age: 111,
            url: 'http://baidu.com'
        }
    });
    //调用send函数，send通过promise异步返回response
    let response = await request.send();
    //打印response
    console.log(response);
}();