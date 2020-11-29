package composite

import io.littlelanguages.data.Tuple2

data class SimpleA(val state: Tuple2<String, String>)

data class SimpleB(val state: List<Tuple2<String, String>>)