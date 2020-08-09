学习笔记
一，实现一个HTTP协议，基础知识
  1，request 组成:
    (1)request line:包含以下三个部分
         method：POST/GET/DELET/PUT。。。
         path:路径 
         Host：127.0.0.1
         HTTP/HTTP版本：此处使用1.1
    （2）headers:多行，键值对方式，以一个空行结束
    （3）body:x=aaa&code=bbb
         body格式以content-Type决定，总体以键值对，但具体方式由content-Type决定
  2，response 组成:
    (1)，第一行，status line，由三部分组成
        HTTP协议版本号
        HTTP状态码（500服务器系列，404，200，300系列）
        HTTP号状态文本
   （2)，第二部分，Header，与body用空行分隔
    (3)，四三部分，body，也是由content_type决定，格式chunked body格式（node默认返回的body格式），首先由16进制的数字单独占一行，后面跟内容，再跟16进制数字切分，再跟内容，最后由16进制的0结尾

二，实现流程
  1，设计一个HTTP请求类（按照request对象要求，配置多徐config对）
  2，send函数编写（异步请求，返回promise，把请求真实发送到夫妻）
  3，已有connection或者创建新的connection连接，监听返回，并把收到的数据给parser,再根据parser状态，resolve Promiss
  4,上一步数据给parser，response必须分段构造，需要新建responseParser类来装配，分段处理response的字符串
  5，response body处理和head有关，新建responseParser类处理boy
  6，responseParser处理识别到，body结尾16进制0的时候，为结束，状态fish置为true，sand,的promise函数返回resolve
  7，HTTP请求函数收到response,响应成功