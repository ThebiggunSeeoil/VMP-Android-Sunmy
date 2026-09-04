package woyou.aidlservice.jiuiv5;

/**
 * 打印服务执行结果的回调
 */
interface ICallback {

	/**
	* 返回执行结果
	* @param isSuccess:	true执行成功，false 执行失败
	*/
	oneway void onRunResult(boolean isSuccess);

	/**
	* 返回结果(字符串数据)
	* @param result:	结果，打印完成后返回
	*/
	oneway void onReturnString(String result);

	/**
	* 执行发生异常
	* errorCode： 异常代码
	* errorMessage： 异常描述
	*/
	oneway void onRaiseException(int errorCode, String errorMessage);

	/**
	* 返回打印机最新状态
	* statusCode:	状态码
	* statusMessage:	状态描述
	*/
	oneway void onPrintResult(int code, String msg);

}
