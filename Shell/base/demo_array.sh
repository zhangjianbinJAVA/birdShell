#!/bin/bash

# 一对括号表示是数组，数组元素用“空格”符号分割开。
a=(1 2 3 4 5)

###### 获取 ######
echo "获取"
a=(1 2 3 4 5)

# 用${#数组名[@或*]} 可以得到数组长度
echo ${#a[@]}
echo ${#a[*]}

# 用${数组名[下标]} 可以得到指定下标的值，下标是从0开始
echo ${a[2]}

# 用${数组名[@或*]} 可以得到整个数组内容
echo ${a[@]}
echo ${a[*]}

###### 赋值 ######
echo "赋值"
a=(1 2 3 4 5)

# 直接通过 数组名[下标] 就可以对其进行引用赋值
a[1]=100

# 如果下标不存在，自动添加新一个数组元素
a[1000]=1000

echo ${a[*]}
echo ${#a[*]}

###### 删除 ######
echo "删除"
a=(1 2 3 4 5)

# unset 数组[下标] 可以清除相应的元素
unset a[1]

echo ${a[*]}
echo ${#a[*]}

# unset 数组[下标] 不带下标，清除整个数据。
unset a

echo ${a[*]}
echo ${#a[*]}

###### 截取 ######
echo "截取"
a=(1 2 3 4 5)

# 截取数组 ${数组名[@或*]:起始位置:长度}，从下标0开始，截取长度为3，切片原先数组，返回是字符串，中间用“空格”分开
echo ${a[@]:0:3}
echo ${a[*]}

# 如果加上”()”，将得到切片数组，上面例子：c 就是一个新数据。
c=(${a[@]:1:4})
echo ${c[*]}
echo ${#c[*]}

###### 替换 ######
echo "替换"
a=(1 2 3 4 5)

# ${数组名[@或*]/查找字符/替换字符} 该操作不会改变原先数组内容，如果需要修改，可以看上面例子，重新定义数据。
echo ${a[@]/3/100}
echo ${a[@]}

# 如果需要需求，重新赋值给变量a
a=(${a[@]/3/100})
echo ${a[@]}

###### 根据分隔符拆分字符串为数组 ######
echo "根据分隔符拆分字符串为数组"
a="one,two,three,four"

# 要将$a按照","分割开，并且存入到新的数组中
OLD_IFS="$IFS"
IFS=","
arr=($a)
IFS="$OLD_IFS"
for s in ${arr[@]}
do
    echo "$s"
done

# arr=($a)用于将字符串$a分割到数组$arr ${arr[0]} ${arr[1]} ... 分别存储分割后的数组第1 2 ... 项 ，${arr[@]}存储整个数组。变量$IFS存储着分隔符，这里我们将其设为逗号 "," OLD_IFS用于备份默认的分隔符，使用完后将之恢复默认。